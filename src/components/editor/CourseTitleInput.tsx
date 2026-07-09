/**
 * CourseTitleInput.tsx
 *
 * Companion to CourseNoInput — lets the user look a saved course up by its
 * TITLE instead of its number (handy when you remember the subject name but
 * not the course code).
 * - On focus: shows saved course titles in a dropdown
 * - On select: auto-fills course no, and triggers teacher/type autofill
 *   via the same onCourseSelect callback as CourseNoInput
 * - Plain typing still works as a normal free-text title field
 */

import { Cross1Icon } from '@radix-ui/react-icons';
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
import { type CourseRecord, getAllCourses } from '@/lib/packet-storage';
import { Button } from '../ui/button';
import { FormItemContext } from './form-item';

type StringAtom = WritableAtom<string, [string | typeof RESET], void>;

interface Props {
  courseNoAtom: StringAtom;
  courseTitleAtom: StringAtom;
  onCourseSelect?: (courseNo: string, record: CourseRecord) => void;
}

export function CourseTitleInput({
  courseNoAtom,
  courseTitleAtom,
  onCourseSelect,
}: Props) {
  const [value, onValueChange] = useAtom(courseTitleAtom);
  const reset = useResetAtom(courseTitleAtom);
  const setCourseNo = useSetAtom(courseNoAtom);

  const [open, setOpen] = useState(false);
  const [savedCourses, setSavedCourses] = useState<
    Record<string, CourseRecord>
  >({});
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
    return matchSorter(entries, search, { keys: ['title', 'code'] });
  }, [savedCourses, search]);

  const hasSuggestions = courseList.length > 0;

  const onSelectCourse = (code: string) => {
    const record = savedCourses[code];
    if (!record) return;

    onValueChange(record.title);
    setCourseNo(code);
    onCourseSelect?.(code, record);

    setOpen(false);
  };

  const handleFocus = () => {
    if (hasSuggestions) setOpen(true);
  };

  const handleValueChange = (v: string) => {
    onValueChange(v);
    if (hasSuggestions) setOpen(true);
  };

  useEffect(() => {
    if (inputRef.current) inputRef.current.id = id;
  });

  return (
    <div className="relative">
      <Popover open={open && hasSuggestions} onOpenChange={setOpen}>
        <Command shouldFilter={false} className="bg-transparent">
          <div className="relative">
            <PopoverAnchor asChild>
              <CommandPrimitive.Input
                asChild
                value={value}
                onValueChange={handleValueChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                }}
                onFocus={handleFocus}
              >
                <Input ref={inputRef} placeholder="Course Title" />
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
              <CommandGroup heading="Saved courses">
                {courseList.map((item) => (
                  <CommandItem
                    key={item.code}
                    value={item.code}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={onSelectCourse}
                  >
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.code}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </div>
  );
}
