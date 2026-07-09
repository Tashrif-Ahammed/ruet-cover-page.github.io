/**
 * teacher-name.tsx  (updated)
 *
 * Changes:
 * 1. Receives `courseTeachers` prop — teachers saved for the current course.
 * 2. If courseTeachers is empty → falls back to RUET API list (manual mode).
 * 3. If courseTeachers has entries → dropdown shows those teachers first.
 * 4. Edit (✏️) button dismisses course-teacher suggestions, shows API list.
 */

import { ArrowLeftIcon, Cross1Icon, Pencil1Icon } from '@radix-ui/react-icons';
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
import { Skeleton } from '@/components/ui/skeleton';
import type { TeacherRecord } from '@/lib/packet-storage';
import { useApiTeachers } from '@/lib/use-api-teachers';
import { cn } from '@/lib/utils';
import { departmentLongMap, departmentShortMap } from '@/store/editor';
import { Button } from '../ui/button';
import { FormItemContext } from './form-item';
import classes from './teacher-name.module.css';

type StringAtom = WritableAtom<string, [string | typeof RESET], void>;

interface Props {
  nameAtom: StringAtom;
  designationAtom: WritableAtom<string, [string], void>;
  departmentAtom: WritableAtom<string, [string], void>;
  courseTeachers?: TeacherRecord[];
}

export function TeacherName({
  nameAtom,
  designationAtom,
  departmentAtom,
  courseTeachers = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [value, onValueChange] = useAtom(nameAtom);
  const reset = useResetAtom(nameAtom);
  const search = useDeferredValue(value);
  const setDesignation = useSetAtom(designationAtom);
  const setDepartment = useSetAtom(departmentAtom);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { id } = useContext(FormItemContext);

  const hasCourseTeachers = courseTeachers.length > 0;

  useEffect(() => {
    setManualMode(false);
  }, [courseTeachers]);

  const { data: apiTeachers, isLoading } = useApiTeachers();

  const filteredCourseTeachers = useMemo(() => {
    if (!hasCourseTeachers) return [];
    if (!search) return courseTeachers;
    return matchSorter(courseTeachers, search, {
      keys: ['name', 'designation', 'dept'],
    });
  }, [courseTeachers, search, hasCourseTeachers]);

  const filteredApiTeachers = useMemo(() => {
    if (!apiTeachers) return [];
    if (!search) return apiTeachers.slice(0, 5);
    return matchSorter(apiTeachers, search, {
      keys: ['name', 'post', 'dept'],
    }).slice(0, 5);
  }, [apiTeachers, search]);

  const showCourseList = hasCourseTeachers && !manualMode;
  const showApiList = manualMode || !hasCourseTeachers;

  const [selected, setSelected] = useState('');
  useEffect(() => {
    const first = showCourseList
      ? filteredCourseTeachers[0]
        ? `${filteredCourseTeachers[0].name}-${filteredCourseTeachers[0].designation}`
        : ''
      : (filteredApiTeachers[0]?.id ?? '');
    setSelected(first);
  }, [filteredCourseTeachers, filteredApiTeachers, showCourseList]);

  const onSelectCourseTeacher = (record: TeacherRecord) => {
    onValueChange(record.name);
    setDesignation(record.designation);
    if (record.dept) setDepartment(record.dept);
    setOpen(false);
  };

  const onSelectApiTeacher = (itemId: string) => {
    if (!apiTeachers) return;
    const i = +itemId.slice(itemId.lastIndexOf(':') + 1);
    const teacher = apiTeachers[i];
    if (teacher) {
      onValueChange(teacher.name || '');
      setDesignation(teacher.post || '');
      const dept = departmentLongMap[teacher.dept.toLowerCase()];
      dept && setDepartment(dept);
    }
    setOpen(false);
  };

  useEffect(() => {
    inputRef.current?.setAttribute('id', id);
    inputRef.current
      ?.closest('[cmdk-root]')
      ?.querySelector('label')
      ?.setAttribute('for', id);
  });

  const hasDropdownItems = showCourseList
    ? filteredCourseTeachers.length > 0
    : filteredApiTeachers.length > 0 || isLoading;

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        open && classes.containerFullScreen,
      )}
    >
      <button
        type="button"
        className={cn('hidden', classes.backDrop)}
        onClick={() => setOpen(false)}
        tabIndex={-1}
      />
      <Button
        variant="outline"
        size="icon"
        className={cn('hidden', classes.back)}
        onClick={() => setOpen(false)}
      >
        <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Back</span>
      </Button>

      <Popover open={open && hasDropdownItems} onOpenChange={setOpen}>
        <Command
          shouldFilter={false}
          value={selected}
          onValueChange={setSelected}
          className={cn('bg-transparent flex-1', classes.command)}
        >
          <div className="relative">
            <PopoverAnchor asChild>
              <CommandPrimitive.Input
                asChild
                value={value}
                onValueChange={onValueChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setManualMode(true);
                  } else {
                    setOpen(e.key !== 'Escape');
                  }
                }}
                onMouseDown={() => setOpen((o) => !!value || !o)}
                onFocus={() => setOpen(true)}
                className={classes.input}
              >
                <Input placeholder="Teacher" ref={inputRef} />
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
              {isLoading && showApiList && (
                <CommandPrimitive.Loading>
                  <div className="p-1">
                    <Skeleton className="h-6 w-full" />
                  </div>
                </CommandPrimitive.Loading>
              )}

              {showCourseList && filteredCourseTeachers.length > 0 && (
                <CommandGroup heading="Course teachers">
                  {filteredCourseTeachers.map((t) => (
                    <CommandItem
                      key={`${t.name}-${t.designation}-${t.dept}`}
                      value={`${t.name}-${t.designation}-${t.dept}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => onSelectCourseTeacher(t)}
                      className="block"
                    >
                      <div>{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.designation}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.dept}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {showApiList && filteredApiTeachers.length > 0 && !isLoading && (
                <CommandGroup>
                  {filteredApiTeachers.map((teacher) => (
                    <CommandItem
                      key={teacher.id}
                      value={teacher.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={onSelectApiTeacher}
                      className="block"
                    >
                      <div>{teacher.name}</div>
                      <div className="text-xs">{teacher.post}</div>
                      <div className="text-xs">
                        Dept. of{' '}
                        {departmentShortMap[teacher.dept.toLowerCase()]}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>

      {hasCourseTeachers && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="manual edit"
          title={manualMode ? 'Back to suggestions' : 'Type manually'}
          onClick={() => {
            setManualMode((m) => !m);
            setOpen(false);
            inputRef.current?.focus();
          }}
          className="shrink-0"
        >
          <Pencil1Icon
            className={cn('h-4 w-4', manualMode ? 'opacity-100' : 'opacity-60')}
          />
        </Button>
      )}
    </div>
  );
}
