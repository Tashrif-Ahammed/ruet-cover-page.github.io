/**
 * LabReportPresetPicker.tsx
 *
 * A small "list" icon-button that opens a popover of saved report/assignment
 * number+title presets (managed from the Personal Data tab, per course).
 * Picking one fills BOTH the cover no. and title fields together, so they
 * never end up mismatched. Meant to sit right next to either field.
 */

import { ListBulletIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { LabReportPreset } from '@/lib/packet-storage';

interface Props {
  presets: LabReportPreset[];
  onSelect: (preset: LabReportPreset) => void;
}

export function LabReportPresetPicker({ presets, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  if (!presets.length) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="saved report presets"
          title="Pick a saved report/assignment no. & title"
        >
          <ListBulletIcon className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandList>
            <CommandEmpty>No saved presets.</CommandEmpty>
            <CommandGroup heading="Saved presets">
              {presets.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                >
                  <div>
                    <div className="font-medium">No. {p.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.title}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
