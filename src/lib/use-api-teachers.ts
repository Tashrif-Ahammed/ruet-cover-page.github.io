import { useQuery } from '@tanstack/react-query';
import * as idbKeyVal from 'idb-keyval';
import { teachersIDBStore } from '@/store/editor';

export interface ApiTeacher {
  id: string;
  name: string;
  post: string;
  dept: string;
}

/** Fetches (and caches for 1h) the RUET teacher directory used for suggestions. */
export function useApiTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async (): Promise<ApiTeacher[]> => {
      try {
        const updatedAt = (await idbKeyVal.get(
          'updatedAt',
          teachersIDBStore,
        )) as Date | null;
        if (Date.now() - (updatedAt?.getTime() || 0) < 36e5) {
          const teachers = await idbKeyVal.get('teachers', teachersIDBStore);
          if (Array.isArray(teachers)) return teachers;
        }
        const res = await fetch(`${process.env.PUBLIC_API}/teachers`);
        const data = await res.json();
        const teachers = (
          data.list as { name: string; post: string; dept: string }[]
        )
          .filter((x) => x.post !== 'Head')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((x, i) => ({ ...x, id: `${x.name} ${x.dept} ${x.post}:${i}` }));
        await idbKeyVal.setMany(
          [
            ['updatedAt', new Date()],
            ['teachers', teachers],
          ],
          teachersIDBStore,
        );
        return teachers;
      } catch {
        const teachers = await idbKeyVal.get('teachers', teachersIDBStore);
        return Array.isArray(teachers) ? teachers : [];
      }
    },
  });
}
