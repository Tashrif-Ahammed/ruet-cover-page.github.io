/**
 * personal-data.tsx
 *
 * "Personal Data" tab — a management surface over the data that used to be
 * saved only implicitly (on PDF download). Lets Tuhin directly:
 *  - add/edit/delete saved students, and mark one as the active student
 *  - add/edit/delete saved courses, manage their teacher list, and manage
 *    optional lab-report/assignment number+title presets per course
 *
 * Applying ("Use") a record here writes straight into the same editor atoms
 * the Student/Subject/Teacher tabs use — and since those atoms persist to
 * localStorage already, whatever was last "used" here is what auto-fills the
 * next time the app is opened.
 */

import {
  Cross2Icon,
  Pencil1Icon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { useSetAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  addLabReportPreset,
  addTeacherToCourse,
  type CourseRecord,
  deleteCourse,
  deleteStudent,
  getAllCourses,
  getAllStudents,
  getMostRecentTeacher,
  removeLabReportPreset,
  removeTeacherFromCourse,
  type StudentRecord,
  saveCourseManual,
  saveStudentManual,
} from '@/lib/packet-storage';
import { useApiTeachers } from '@/lib/use-api-teachers';
import editorStore, {
  departments,
  designations,
  studentDepartments,
  types,
} from '@/store/editor';

// ─── Shared card shell ───────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2 not-prose">
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  variant = 'ghost',
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'ghost' | 'destructive';
}) {
  return (
    <Button
      variant={variant === 'destructive' ? 'ghost' : 'ghost'}
      size="icon"
      className={
        variant === 'destructive'
          ? 'size-7 text-destructive hover:text-destructive'
          : 'size-7'
      }
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function PersonalDataTab() {
  return (
    <div className="space-y-8">
      <StudentSection />
      <hr className="-mx-4 border-input" />
      <CourseSection />
    </div>
  );
}

// ─── Student section ─────────────────────────────────────────────────────────

function StudentSection() {
  const [students, setStudents] = useState<Record<string, StudentRecord>>({});
  const [dialogRoll, setDialogRoll] = useState<string | null | undefined>(
    undefined,
  ); // undefined = closed, null = new, string = editing that roll
  const setTab = useSetAtom(editorStore.editorTab);
  const setStudentID = useSetAtom(editorStore.studentID);
  const setStudentName = useSetAtom(editorStore.studentName);
  const setStudentSection = useSetAtom(editorStore.studentSection);
  const setStudentDepartment = useSetAtom(editorStore.studentDepartment);
  const setStudentGroup = useSetAtom(editorStore.studentGroup);

  const refresh = () => getAllStudents().then(setStudents);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh only needs to run once on mount
  useEffect(() => {
    refresh();
  }, []);

  const list = useMemo(
    () =>
      Object.entries(students).sort(
        (a, b) => (b[1].lastUsed ?? 0) - (a[1].lastUsed ?? 0),
      ),
    [students],
  );

  const applyStudent = (roll: string, s: StudentRecord) => {
    setStudentID(roll);
    setStudentName(s.name);
    setStudentSection(s.section);
    if (s.dept) setStudentDepartment(s.dept as never);
    setStudentGroup(s.group);
    setTab('student');
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="mb-0">Students</h2>
        <Button size="sm" variant="outline" onClick={() => setDialogRoll(null)}>
          <PlusIcon /> Add student
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-0">
        Preset a student's info once, then reuse it from the roll dropdown on
        the Student tab. "Use" applies it as the active student right away.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved students yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map(([roll, s]) => (
            <Card key={roll}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{roll}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {s.name || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[s.dept, s.section && `Sec ${s.section}`, s.group]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <IconButton label="Edit" onClick={() => setDialogRoll(roll)}>
                    <Pencil1Icon />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    variant="destructive"
                    onClick={async () => {
                      await deleteStudent(roll);
                      refresh();
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => applyStudent(roll, s)}
              >
                Use this student
              </Button>
            </Card>
          ))}
        </div>
      )}

      {dialogRoll !== undefined && (
        <StudentDialog
          roll={dialogRoll}
          existing={dialogRoll ? students[dialogRoll] : undefined}
          onClose={() => setDialogRoll(undefined)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

function StudentDialog({
  roll,
  existing,
  onClose,
  onSaved,
}: {
  roll: string | null;
  existing?: StudentRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rollValue, setRollValue] = useState(roll ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [section, setSection] = useState(existing?.section ?? '');
  const [dept, setDept] = useState(existing?.dept ?? '');
  const [group, setGroup] = useState(existing?.group ?? '');
  const isEdit = roll !== null;

  const canSave = rollValue.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    await saveStudentManual(rollValue.trim(), { name, section, dept, group });
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit student' : 'Add new student'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student ID / Roll</Label>
            <Input
              value={rollValue}
              disabled={isEdit}
              onChange={(e) => setRollValue(e.currentTarget.value)}
              placeholder="e.g. 2101001"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {studentDepartments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Input
                value={section}
                onChange={(e) => setSection(e.currentTarget.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Group</Label>
            <Input
              value={group}
              onChange={(e) => setGroup(e.currentTarget.value)}
              placeholder="leave empty if not applicable"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course + Teacher + Lab report section ──────────────────────────────────

function CourseSection() {
  const [courses, setCourses] = useState<Record<string, CourseRecord>>({});
  const [dialogCourseNo, setDialogCourseNo] = useState<
    string | null | undefined
  >(undefined);
  const setTab = useSetAtom(editorStore.editorTab);
  const setCourseNo = useSetAtom(editorStore.courseNo);
  const setCourseTitle = useSetAtom(editorStore.courseTitle);
  const setType = useSetAtom(editorStore.type);
  const setTeacherName = useSetAtom(editorStore.teacherName);
  const setTeacherDesignation = useSetAtom(editorStore.teacherDesignation);
  const setTeacherDepartment = useSetAtom(editorStore.teacherDepartment);

  const refresh = () => getAllCourses().then(setCourses);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh only needs to run once on mount
  useEffect(() => {
    refresh();
  }, []);

  const list = useMemo(
    () =>
      Object.entries(courses).sort(
        (a, b) => (b[1].lastUsed ?? 0) - (a[1].lastUsed ?? 0),
      ),
    [courses],
  );

  const applyCourse = (courseNo: string, record: CourseRecord) => {
    setCourseNo(courseNo);
    setCourseTitle(record.title);
    if (record.type) setType(record.type as never);
    const recent = getMostRecentTeacher(record);
    if (recent) {
      setTeacherName(recent.name);
      setTeacherDesignation(recent.designation);
      setTeacherDepartment(recent.dept);
    }
    setTab('subject');
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="mb-0">Courses &amp; Teachers</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogCourseNo(null)}
        >
          <PlusIcon /> Add course
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-0">
        Each course keeps its own teacher list and, optionally, saved report
        numbers &amp; titles you can reuse from the Subject tab.
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved courses yet.</p>
      ) : (
        <div className="space-y-3">
          {list.map(([courseNo, record]) => (
            <CourseCard
              key={courseNo}
              courseNo={courseNo}
              record={record}
              onUse={() => applyCourse(courseNo, record)}
              onEdit={() => setDialogCourseNo(courseNo)}
              onDelete={async () => {
                await deleteCourse(courseNo);
                refresh();
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {dialogCourseNo !== undefined && (
        <CourseDialog
          courseNo={dialogCourseNo}
          existing={dialogCourseNo ? courses[dialogCourseNo] : undefined}
          onClose={() => setDialogCourseNo(undefined)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}

function CourseDialog({
  courseNo,
  existing,
  onClose,
  onSaved,
}: {
  courseNo: string | null;
  existing?: CourseRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [noValue, setNoValue] = useState(courseNo ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState<string>(existing?.type ?? types[0]);
  const isEdit = courseNo !== null;
  const canSave = noValue.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    await saveCourseManual(noValue.trim(), title, type);
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit course' : 'Add new course'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Course no. / code</Label>
            <Input
              value={noValue}
              disabled={isEdit}
              onChange={(e) => setNoValue(e.currentTarget.value)}
              placeholder="e.g. EEE 3216"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Course title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseCard({
  courseNo,
  record,
  onUse,
  onEdit,
  onDelete,
  onChanged,
}: {
  courseNo: string;
  record: CourseRecord;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [addingReport, setAddingReport] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{courseNo}</div>
          <div className="text-sm text-muted-foreground truncate">
            {record.title || '—'}
          </div>
          {record.type && (
            <span className="inline-block mt-1 rounded-full border px-2 py-0.5 text-[0.7rem] text-muted-foreground">
              {record.type}
            </span>
          )}
        </div>
        <div className="flex shrink-0">
          <IconButton label="Edit" onClick={onEdit}>
            <Pencil1Icon />
          </IconButton>
          <IconButton label="Delete" variant="destructive" onClick={onDelete}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      <Button size="sm" variant="secondary" className="w-full" onClick={onUse}>
        Use this course
      </Button>

      {/* Teachers */}
      <div className="rounded-md border p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Teachers
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setAddingTeacher((v) => !v)}
          >
            {addingTeacher ? 'Cancel' : '+ Add'}
          </Button>
        </div>
        {record.teachers.length > 0 && (
          <ul className="space-y-1">
            {record.teachers.map((t) => (
              <li
                key={`${t.name}-${t.designation}-${t.dept}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">
                  {t.name}
                  {t.designation ? `, ${t.designation}` : ''}
                  {t.dept ? ` (${t.dept})` : ''}
                </span>
                <IconButton
                  label="Remove teacher"
                  variant="destructive"
                  onClick={async () => {
                    await removeTeacherFromCourse(courseNo, t);
                    onChanged();
                  }}
                >
                  <Cross2Icon className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {addingTeacher && (
          <AddTeacherForm
            onAdd={async (teacher) => {
              await addTeacherToCourse(courseNo, teacher);
              setAddingTeacher(false);
              onChanged();
            }}
          />
        )}
      </div>

      {/* Lab report presets (optional) */}
      <div className="rounded-md border p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Lab report / assignment presets (optional)
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setAddingReport((v) => !v)}
          >
            {addingReport ? 'Cancel' : '+ Add'}
          </Button>
        </div>
        {!!record.labReports?.length && (
          <ul className="space-y-1">
            {record.labReports.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">
                  No. {p.number} — {p.title}
                </span>
                <IconButton
                  label="Remove preset"
                  variant="destructive"
                  onClick={async () => {
                    await removeLabReportPreset(courseNo, p.id);
                    onChanged();
                  }}
                >
                  <Cross2Icon className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {addingReport && (
          <AddReportPresetForm
            onAdd={async (preset) => {
              await addLabReportPreset(courseNo, preset);
              setAddingReport(false);
              onChanged();
            }}
          />
        )}
      </div>
    </Card>
  );
}

function AddTeacherForm({
  onAdd,
}: {
  onAdd: (t: {
    name: string;
    designation: string;
    dept: string;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState<string>(designations[0]);
  const [dept, setDept] = useState('');
  const { data: apiTeachers } = useApiTeachers();
  const datalistId = useMemo(
    () => `teacher-suggestions-${Math.random().toString(36).slice(2)}`,
    [],
  );

  return (
    <div className="space-y-1.5 pt-1">
      <Input
        list={datalistId}
        placeholder="Teacher name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <datalist id={datalistId}>
        {apiTeachers?.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-1.5">
        <Select value={designation} onValueChange={setDesignation}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Designation" />
          </SelectTrigger>
          <SelectContent>
            {designations.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!name.trim()}
        onClick={() => onAdd({ name: name.trim(), designation, dept })}
      >
        Add teacher
      </Button>
    </div>
  );
}

function AddReportPresetForm({
  onAdd,
}: {
  onAdd: (p: { number: string; title: string }) => void | Promise<void>;
}) {
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');

  return (
    <div className="space-y-1.5 pt-1">
      <div className="grid grid-cols-[5rem_1fr] gap-1.5">
        <Input
          placeholder="No."
          value={number}
          onChange={(e) => setNumber(e.currentTarget.value)}
        />
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!number.trim() && !title.trim()}
        onClick={() => onAdd({ number: number.trim(), title: title.trim() })}
      >
        Add preset
      </Button>
    </div>
  );
}
