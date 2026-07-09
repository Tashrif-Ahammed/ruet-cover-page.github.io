/**
 * packet-storage.ts
 *
 * Centralized read/write logic for student and course packets.
 *
 * Two write paths:
 * 1. Implicit — a record is saved automatically after a PDF is actually
 *    downloaded (as late as possible = after fileSave resolves).
 * 2. Explicit — the "Personal Data" tab lets the user directly manage
 *    (add/edit/delete) students, courses, teachers and lab report presets
 *    without needing to generate a PDF first.
 */

import * as idbKeyVal from 'idb-keyval';

// ─── Stores ──────────────────────────────────────────────────────────────────

export const studentPacketStore = idbKeyVal.createStore(
  'student-packet',
  'student-packet',
);

export const coursePacketStore = idbKeyVal.createStore(
  'course-packet',
  'course-packet',
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudentRecord {
  name: string;
  section: string;
  dept: string;
  group: string;
  /** timestamp ms — updated whenever this student is saved/used, for "last used" sorting */
  lastUsed?: number;
}

export interface TeacherRecord {
  name: string;
  designation: string;
  dept: string;
  lastUsed: number; // timestamp ms — for priority sorting
}

export interface LabReportPreset {
  /** 4 char unique id */
  id: string;
  number: string;
  title: string;
}

export interface CourseRecord {
  title: string;
  teachers: TeacherRecord[];
  /** default cover type for this course, e.g. 'Lab Report' | 'Assignment' | 'Report' | 'Thesis' */
  type?: string;
  /** optional saved report/assignment numbers + titles for quick reuse */
  labReports?: LabReportPreset[];
  lastUsed?: number;
}

function genId() {
  return Math.random().toString(36).slice(2, 6);
}

// ─── Student Packet ──────────────────────────────────────────────────────────

/** Returns all saved students as { [roll]: StudentRecord } */
export async function getAllStudents(): Promise<Record<string, StudentRecord>> {
  try {
    const data = await idbKeyVal.get<Record<string, StudentRecord>>(
      '__all__',
      studentPacketStore,
    );
    return data ?? {};
  } catch {
    return {};
  }
}

/** Returns a single student by roll, or null */
export async function getStudent(roll: string): Promise<StudentRecord | null> {
  const all = await getAllStudents();
  return all[roll] ?? null;
}

/**
 * Saves (or overwrites) a student record.
 * Called AFTER fileSave resolves (implicit save-on-download path).
 */
export async function saveStudent(
  roll: string,
  record: StudentRecord,
): Promise<void> {
  if (!roll) return;
  const all = await getAllStudents();
  all[roll] = { ...record, lastUsed: Date.now() };
  await idbKeyVal.set('__all__', all, studentPacketStore);
}

/** Explicit add/edit from the Personal Data tab. */
export async function saveStudentManual(
  roll: string,
  record: Omit<StudentRecord, 'lastUsed'>,
): Promise<void> {
  return saveStudent(roll, record as StudentRecord);
}

/** Deletes a student record by roll. */
export async function deleteStudent(roll: string): Promise<void> {
  const all = await getAllStudents();
  delete all[roll];
  await idbKeyVal.set('__all__', all, studentPacketStore);
}

/** Returns the roll of the most recently used/saved student, or null. */
export async function getMostRecentStudentRoll(): Promise<string | null> {
  const all = await getAllStudents();
  const entries = Object.entries(all);
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1].lastUsed ?? 0) - (a[1].lastUsed ?? 0));
  return entries[0][0];
}

// ─── Course Packet ───────────────────────────────────────────────────────────

/** Returns all saved courses as { [courseCode]: CourseRecord } */
export async function getAllCourses(): Promise<Record<string, CourseRecord>> {
  try {
    const data = await idbKeyVal.get<Record<string, CourseRecord>>(
      '__all__',
      coursePacketStore,
    );
    return data ?? {};
  } catch {
    return {};
  }
}

/** Returns a single course record, or null */
export async function getCourse(
  courseNo: string,
): Promise<CourseRecord | null> {
  const all = await getAllCourses();
  return all[courseNo] ?? null;
}

/**
 * Saves course data. Teacher list: no duplicates (matched by name+designation+dept).
 * If same teacher exists, only lastUsed is updated.
 * Called AFTER fileSave resolves (implicit save-on-download path).
 */
export async function saveCourse(
  courseNo: string,
  title: string,
  teacher: TeacherRecord | null,
  type?: string,
): Promise<void> {
  if (!courseNo) return;
  const all = await getAllCourses();
  const existing = all[courseNo];

  if (!existing) {
    all[courseNo] = {
      title,
      teachers: teacher ? [teacher] : [],
      type,
      lastUsed: Date.now(),
    };
  } else {
    // Update title
    existing.title = title || existing.title;
    if (type) existing.type = type;
    existing.lastUsed = Date.now();

    if (teacher) {
      const idx = existing.teachers.findIndex(
        (t) =>
          t.name === teacher.name &&
          t.designation === teacher.designation &&
          t.dept === teacher.dept,
      );
      if (idx >= 0) {
        // same teacher → update lastUsed only
        existing.teachers[idx].lastUsed = teacher.lastUsed;
      } else {
        // new teacher for this course → append
        existing.teachers.push(teacher);
      }
    }

    all[courseNo] = existing;
  }

  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Explicit add/edit of course no/title/type from the Personal Data tab (doesn't touch teachers). */
export async function saveCourseManual(
  courseNo: string,
  title: string,
  type?: string,
): Promise<void> {
  if (!courseNo) return;
  const all = await getAllCourses();
  const existing = all[courseNo];
  if (!existing) {
    all[courseNo] = { title, teachers: [], type, lastUsed: Date.now() };
  } else {
    existing.title = title;
    existing.type = type;
    existing.lastUsed = Date.now();
    all[courseNo] = existing;
  }
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Deletes a course record entirely. */
export async function deleteCourse(courseNo: string): Promise<void> {
  const all = await getAllCourses();
  delete all[courseNo];
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Adds or updates a teacher on a course (matched by name+designation+dept). */
export async function addTeacherToCourse(
  courseNo: string,
  teacher: Omit<TeacherRecord, 'lastUsed'>,
): Promise<void> {
  await saveCourse(courseNo, '', { ...teacher, lastUsed: Date.now() });
}

/** Removes a teacher from a course by name+designation+dept. */
export async function removeTeacherFromCourse(
  courseNo: string,
  teacher: Pick<TeacherRecord, 'name' | 'designation' | 'dept'>,
): Promise<void> {
  const all = await getAllCourses();
  const existing = all[courseNo];
  if (!existing) return;
  existing.teachers = existing.teachers.filter(
    (t) =>
      !(
        t.name === teacher.name &&
        t.designation === teacher.designation &&
        t.dept === teacher.dept
      ),
  );
  all[courseNo] = existing;
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Adds a lab report / assignment number+title preset to a course. */
export async function addLabReportPreset(
  courseNo: string,
  preset: Omit<LabReportPreset, 'id'>,
): Promise<void> {
  const all = await getAllCourses();
  const existing = all[courseNo];
  if (!existing) return;
  const list = existing.labReports ?? [];
  list.push({ ...preset, id: genId() });
  existing.labReports = list;
  all[courseNo] = existing;
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Updates an existing lab report preset by id. */
export async function updateLabReportPreset(
  courseNo: string,
  id: string,
  preset: Omit<LabReportPreset, 'id'>,
): Promise<void> {
  const all = await getAllCourses();
  const existing = all[courseNo];
  if (!existing?.labReports) return;
  existing.labReports = existing.labReports.map((p) =>
    p.id === id ? { ...preset, id } : p,
  );
  all[courseNo] = existing;
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/** Removes a lab report preset from a course by id. */
export async function removeLabReportPreset(
  courseNo: string,
  id: string,
): Promise<void> {
  const all = await getAllCourses();
  const existing = all[courseNo];
  if (!existing?.labReports) return;
  existing.labReports = existing.labReports.filter((p) => p.id !== id);
  all[courseNo] = existing;
  await idbKeyVal.set('__all__', all, coursePacketStore);
}

/**
 * Returns the most recently used teacher for a course (by lastUsed timestamp).
 */
export function getMostRecentTeacher(
  course: CourseRecord,
): TeacherRecord | null {
  if (!course.teachers.length) return null;
  return [...course.teachers].sort((a, b) => b.lastUsed - a.lastUsed)[0];
}

/** Returns the courseNo of the most recently used/saved course, or null. */
export async function getMostRecentCourseNo(): Promise<string | null> {
  const all = await getAllCourses();
  const entries = Object.entries(all);
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1].lastUsed ?? 0) - (a[1].lastUsed ?? 0));
  return entries[0][0];
}
