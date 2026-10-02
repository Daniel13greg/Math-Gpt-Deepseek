import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform } from 'react-native';

import PdfExporter from '@/components/dom/PdfExporter';
import { pdfFileName } from '@/lib/tools/printable';
import { toast } from '@/store/toast';
import { t } from '@/i18n';

export interface PdfJob {
  title: string;
  /** Markdown + LaTeX, as shown in the app. Each section starts on a new page. */
  sections: string[];
  /** Small line under the title, e.g. the date. */
  meta?: string;
}

async function savePdf(html: string, title: string) {
  if (Platform.OS === 'web') {
    // Browsers would print the whole app; print the document from a hidden frame ("Save as PDF").
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) throw new Error(t('pdf.printFailed'));
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60_000);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  // Give the file a readable name before sharing it.
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, pdfFileName(title));
  if (target.exists) target.delete();
  await new File(uri).copy(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/**
 * Exports Markdown + LaTeX to a PDF and opens the share sheet. Render `exporter` somewhere in the
 * screen: it is an invisible DOM component that turns the Markdown into printable HTML.
 */
export function usePdfExport() {
  const [job, setJob] = useState<PdfJob | null>(null);

  const exporter = job ? (
    <PdfExporter
      title={job.title}
      sections={job.sections}
      meta={job.meta}
      onHtml={async (html) => {
        const title = job.title;
        setJob(null);
        try {
          await savePdf(html, title);
        } catch (e) {
          toast.error(e instanceof Error && e.message ? e.message : t('pdf.failed'));
        }
      }}
      dom={{ style: { position: 'absolute', width: 1, height: 1, opacity: 0 }, scrollEnabled: false }}
    />
  ) : null;

  return {
    exportPdf: (next: PdfJob) => {
      if (!job) setJob(next);
    },
    exporting: job !== null,
    exporter,
  };
}
