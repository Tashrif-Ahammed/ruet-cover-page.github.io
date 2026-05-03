/**
 * StudentIDInput.tsx
 *
 * Replaces the plain TextInput for Student ID.
 * - On focus/click: shows a dropdown of all saved roll numbers
 * - On select: auto-fills name, section, dept, group
 * - Edit button (✏️) beside dropdown to dismiss and type manually
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
import { getAllStudents, type StudentRecord } from '@/lib/packet-storage';
import { Button } from '../ui/button';
import { FormItemContext } from './form-item';

type StringAtom = WritableAtom<string, [string | typeof RESET], void>;

interface Props {
  idAtom: StringAtom;
  nameAtom: StringAtom;
  sectionAtom: StringAtom;
  deptAtom: WritableAtom<string, [string], void>;
  groupAtom: StringAtom;
}

export function StudentIDInput({
  idAtom,
  nameAtom,
  sectionAtom,
  deptAtom,
  groupAtom,
}: Props) {
  const [value, onValueChange] = useAtom(idAtom);
  const reset = useResetAtom(idAtom);
  const setName = useSetAtom(nameAtom);
  const setSection = useSetAtom(sectionAtom);
  const setDept = useSetAtom(deptAtom);
  const setGroup = useSetAtom(groupAtom);

  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [savedStudents, setSavedStudents] = useState<
    Record<string, StudentRecord>
  >({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { id } = useContext(FormItemContext);
  const search = useDeferredValue(value);

  // Load saved students on mount
  useEffect(() => {
    getAllStudents().then(setSavedStudents);
  }, []);

  const rollList = useMemo(() => {
    const entries = Object.entries(savedStudents).map(([roll, data]) => ({
      roll,
      ...data,
    }));
    if (!search) return entries;
    return matchSorter(entries, search, { keys: ['roll', 'name'] });
  }, [savedStudents, search]);

  const hasSuggestions = rollList.length > 0;

  const onSelectRoll = (roll: string) => {
    const record = savedStudents[roll];
    if (!record) return;
    onValueChange(roll);
    setName(record.name);
    setSection(record.section);
    if (record.dept) setDept(record.dept);
    setGroup(record.group);
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

  // Sync id attribute for label association
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
                <Input ref={inputRef} placeholder="Student ID / Roll" />
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

          {/* Hidden list when closed */}
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
                {rollList.map((item) => (
                  <CommandItem
                    key={item.roll}
                    value={item.roll}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={onSelectRoll}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.roll}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.name}
                        {item.section ? ` · Sec ${item.section}` : ''}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>

      {/* Edit button — visible when dropdown would appear */}
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
