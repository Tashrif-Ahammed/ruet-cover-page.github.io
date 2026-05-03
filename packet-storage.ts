/**
 * packet-storage.ts
 *
 * Centralized read/write logic for student and course packets.
 * Data is saved to IndexedDB only when a PDF is actually downloaded
 * (as late as possible = after fileSave resolves).
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
}

export interface TeacherRecord {
  name: string;
  designation: string;
  dept: string;
  lastUsed: number; // timestamp ms — for priority sorting
}

export interface CourseRecord {
  title: string;
  teachers: TeacherRecord[];
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
export async function getStudent(
  roll: string,
): Promise<StudentRecord | null> {
  const all = await getAllStudents();
  return all[roll] ?? null;
}

/**
 * Saves (or overwrites) a student record.
 * Called AFTER fileSave resolves.
 */
export async function saveStudent(
  roll: string,
  record: StudentRecord,
): Promise<void> {
  if (!roll) return;
  const all = await getAllStudents();
  all[roll] = record;
  await idbKeyVal.set('__all__', all, studentPacketStore);
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
 * Called AFTER fileSave resolves.
 */
export async function saveCourse(
  courseNo: string,
  title: string,
  teacher: TeacherRecord | null,
): Promise<void> {
  if (!courseNo) return;
  const all = await getAllCourses();
  const existing = all[courseNo];

  if (!existing) {
    all[courseNo] = {
      title,
      teachers: teacher ? [teacher] : [],
    };
  } else {
    // Update title
    existing.title = title;

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

/**
 * Returns the most recently used teacher for a course (by lastUsed timestamp).
 */
export function getMostRecentTeacher(
  course: CourseRecord,
): TeacherRecord | null {
  if (!course.teachers.length) return null;
  return [...course.teachers].sort((a, b) => b.lastUsed - a.lastUsed)[0];
}
