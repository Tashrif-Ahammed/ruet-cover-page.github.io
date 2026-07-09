import { DownloadIcon } from '@radix-ui/react-icons';
import { pdf } from '@react-pdf/renderer';
import { fileSave } from 'browser-fs-access';
import { type ComponentProps, type MouseEvent, useTransition } from 'react';
import { saveCourse, saveStudent } from '@/lib/packet-storage';
import { defaultStore } from '@/store';
import editor from '@/store/editor';
import { CoverTemplate } from './cover-template';
import { LoadingSpinner } from './ui/loading-spinner';

export const PDFDownloadLink = ({
  fileName = 'document.pdf',
  ...props
}: { fileName?: string } & ComponentProps<'button'>) => {
  const [isPending, startTransition] = useTransition();
  const fileNameClean = fileName
    .replace(' ', '_')
    .replace(/[^a-zA-Z0-9.\-_]/g, '');

  const handleClick = (
    _event: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
  ) => {
    startTransition(async () => {
      try {
        const blob = await pdf(<CoverTemplate key={Math.random()} />).toBlob();
        if (window.navigator.userAgent === 'ruet-cover-page-gen') {
          const fileReader = new FileReader();
          fileReader.onloadend = () => {
            (
              window as {
                ReactNativeWebView?: {
                  postMessage(msg: string): void;
                };
              }
            ).ReactNativeWebView?.postMessage(
              JSON.stringify({
                dataURI: fileReader.result,
                fileName: fileNameClean,
              }),
            );
          };
          fileReader.readAsDataURL(blob);
          await savePackets();
          return;
        }

        // fileSave resolves only when user confirms save dialog.
        // We save packets AFTER this — so only real confirmed downloads count.
        await fileSave(blob, {
          fileName: fileNameClean,
          extensions: ['.pdf'],
        });

        // ── Truth moment: user actually downloaded the file ──
        await savePackets();
      } catch (error) {
        console.error(error);
        alert('Could not download!');
      }
    });
    try {
      // @ts-expect-error
      window.umami?.track('download-cover-page', {
        studentId: defaultStore.get(editor.studentID) || 'Blank',
        courseNo: defaultStore.get(editor.courseNo) || 'Blank',
        courseTitle: defaultStore.get(editor.courseTitle) || 'Blank',
        teacher: defaultStore.get(editor.teacherName) || 'Blank',
        watermark: defaultStore.get(editor.watermark) ? 'true' : 'false',
      });
    } catch (_err) {
      console.error();
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={isPending} {...props}>
      {isPending ? (
        <LoadingSpinner />
      ) : (
        <DownloadIcon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Download</span>
    </button>
  );
};

export default PDFDownloadLink;

/** Reads current form state and persists to both packets after confirmed download. */
async function savePackets() {
  const roll = defaultStore.get(editor.studentID);
  const name = defaultStore.get(editor.studentName);
  const section = defaultStore.get(editor.studentSection);
  const dept = defaultStore.get(editor.studentDepartment);
  const group = defaultStore.get(editor.studentGroup);

  const courseNo = defaultStore.get(editor.courseNo);
  const courseTitle = defaultStore.get(editor.courseTitle);
  const courseType = defaultStore.get(editor.type);
  const teacherName = defaultStore.get(editor.teacherName);
  const teacherDesignation = defaultStore.get(editor.teacherDesignation);
  const teacherDept = defaultStore.get(editor.teacherDepartment);

  // Student packet — save if roll present
  if (roll) {
    await saveStudent(roll, {
      name: name || '',
      section: section || '',
      dept: (dept as string) || '',
      group: group || '',
    });
  }

  // Course packet — save if courseNo present
  if (courseNo) {
    await saveCourse(
      courseNo,
      courseTitle || '',
      teacherName
        ? {
            name: teacherName,
            designation: teacherDesignation || '',
            dept: (teacherDept as string) || '',
            lastUsed: Date.now(),
          }
        : null,
      courseType,
    );
  }
}
