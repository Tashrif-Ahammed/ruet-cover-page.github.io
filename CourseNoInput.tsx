/**
 * CourseNoInput.tsx
 *
 * Replaces the plain TextInput for Course No / Course Code.
 * - On focus: shows saved course codes in dropdown
 * - On select: auto-fills course title, and triggers teacher autofill
 *   (most recently used teacher for that course)
 * - Edit button to go manual
 */

import { Cross1Icon, Pencil1Icon } from '@radix-ui/react-icons';
import { Command as CommandPrimitive } from 'cmdk';
import { useAtom, useSetAtom, type WritableAtom } from 'jotai';
import { type RESET, useResetAtom } from 'jotai/utils';
import { matchSorter } from 'match-sorter';
import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  getAllCourses,
  getMostRecentTeacher,
  type CourseRecord,
} from '@/lib/packet-storage';
import { Button } from '../ui/button';
import { FormItemContext } from './form-item';

type StringAtom = WritableAtom<string, [string | typeof RESET], void>;

interface Props {
  courseNoAtom: StringAtom;
  courseTitleAtom: StringAtom;
  /** Called with the most recent TeacherRecord when a course is selected */
  onCourseSelect?: (courseNo: string, record: CourseRecord) => void;
}

export function CourseNoInput({
  courseNoAtom,
  courseTitleAtom,
  onCourseSelect,
}: Props) {
  const [value, onValueChange] = useAtom(courseNoAtom);
  const reset = useResetAtom(courseNoAtom);
  const setCourseTitle = useSetAtom(courseTitleAtom);

  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [savedCourses, setSavedCourses] = useState<Record<string, CourseRecord>>(
    {},
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { id } = useContext(FormItemContext);
  const search = useDeferredValue(value);

  useEffect(() => {
    getAllCourses().then(setSavedCourses);
  }, []);

  const courseList = useMemo(() => {
    const entries = Object.entries(savedCourses).map(([code, data]) => ({
      code,
      ...data,
    }));
    if (!search) return entries;
    return matchSorter(entries, search, { keys: ['code', 'title'] });
  }, [savedCourses, search]);

  const hasSuggestions = courseList.length > 0;

  const onSelectCourse = (code: string) => {
    const record = savedCourses[code];
    if (!record) return;

    onValueChange(code);
    setCourseTitle(record.title);

    // Autofill teacher (most recent)
    onCourseSelect?.(code, record);

    setOpen(false);
    setManualMode(false);
  };

  const handleFocus = () => {
    if (!manualMode && hasSuggestions) setOpen(true);
  };

  const handleValueChange = (v: string) => {
    onValueChange(v);
    if (!manualMode && hasSuggestions) setOpen(true);
  };

  useEffect(() => {
    if (inputRef.current) inputRef.current.id = id;
  });

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={open && !manualMode && hasSuggestions}
        onOpenChange={(o) => {
          if (!manualMode) setOpen(o);
        }}
      >
        <Command shouldFilter={false} className="bg-transparent flex-1">
          <div className="relative">
            <PopoverAnchor asChild>
              <CommandPrimitive.Input
                asChild
                value={value}
                onValueChange={handleValueChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setManualMode(true);
                  }
                }}
                onFocus={handleFocus}
              >
                <Input ref={inputRef} placeholder="Course No." />
              </CommandPrimitive.Input>
            </PopoverAnchor>

            {!!value && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 bottom-0 z-10"
                aria-label="reset"
                onClick={() => {
                  reset();
                  setManualMode(false);
                  inputRef.current?.focus();
                }}
              >
                <Cross1Icon className="h-4 w-4 opacity-50" />
              </Button>
            )}
          </div>

          {!open && <CommandList aria-hidden="true" className="hidden" />}

          <PopoverContent
            asChild
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onFocus={() => inputRef.current?.focus()}
            className="w-screen sm:w-[var(--radix-popper-anchor-width)] p-0"
          >
            <CommandList>
              <CommandGroup>
                {courseList.map((item) => (
                  <CommandItem
                    key={item.code}
                    value={item.code}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={onSelectCourse}
                  >
                    <div>
                      <div className="font-medium">{item.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.title}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>

      {hasSuggestions && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="manual edit"
          title="Type manually"
          onClick={() => {
            setManualMode(true);
            setOpen(false);
            inputRef.current?.focus();
          }}
          className="shrink-0"
        >
          <Pencil1Icon className="h-4 w-4 opacity-60" />
        </Button>
      )}
    </div>
  );
}

export { getMostRecentTeacher };
