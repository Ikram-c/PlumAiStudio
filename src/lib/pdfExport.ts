import { jsPDF } from 'jspdf';
import { COCODataset, CategorySummary } from '../types';

export interface PDFExportOptions {
  dataset: COCODataset;
  summaries: CategorySummary[];
  selectedCategory: string;
  areaBins: { label: string; count: number }[];
  aspectRatioBins: { label: string; count: number }[];
  annotationsPerImage: { label: string; count: number }[];
}

export function generateDatasetSummaryPDF({
  dataset,
  summaries,
  selectedCategory,
  areaBins,
  aspectRatioBins,
}: PDFExportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const totalAnnotations = dataset.annotations.length;
  const totalImages = dataset.images.length;
  const totalCategories = dataset.categories.length;
  const avgAreaAll = summaries.length
    ? Math.round(
        summaries.reduce((acc, s) => acc + s.avgArea * s.count, 0) / (totalAnnotations || 1)
      )
    : 0;

  const datasetTitle = dataset.info?.description || 'COCO Object Detection Dataset';
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Helper for page break
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  // 1. Top Dark Slate Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Accent bar
  doc.setFillColor(124, 58, 237); // violet-600
  doc.rect(0, 33, pageWidth, 1.5, 'F');

  doc.setTextColor(167, 139, 250); // violet-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PLUM IMAGE TOOLS • COMPUTER VISION ANALYTICS', margin, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COCO Dataset Statistical Summary Report', margin, 20);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Dataset: ${datasetTitle}   |   Category Filter: ${selectedCategory}   |   Generated: ${timestamp}`,
    margin,
    27.5
  );

  y = 42;

  // 2. KPI Summary Cards (4 columns)
  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 22;

  const kpis = [
    {
      label: 'TOTAL ANNOTATIONS',
      value: totalAnnotations.toLocaleString(),
      sub: `${(totalAnnotations / (totalImages || 1)).toFixed(1)} per image avg`,
      accent: [124, 58, 237] as [number, number, number],
    },
    {
      label: 'DATASET IMAGES',
      value: totalImages.toLocaleString(),
      sub: 'Indexed frames',
      accent: [59, 130, 246] as [number, number, number],
    },
    {
      label: 'ACTIVE CATEGORIES',
      value: totalCategories.toLocaleString(),
      sub: 'Registered classes',
      accent: [16, 185, 129] as [number, number, number],
    },
    {
      label: 'AVG BBOX AREA',
      value: `${avgAreaAll.toLocaleString()} px²`,
      sub: 'Weighted mean',
      accent: [245, 158, 11] as [number, number, number],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');

    // Left accent strip
    doc.setFillColor(kpi.accent[0], kpi.accent[1], kpi.accent[2]);
    doc.roundedRect(cx, y, 1.8, cardHeight, 1, 1, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(kpi.label, cx + 4.5, y + 6);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(kpi.value, cx + 4.5, y + 13.5);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(kpi.sub, cx + 4.5, y + 18.8);
  });

  y += cardHeight + 9;

  // 3. Category Distribution Horizontal Bar Chart
  const maxCategoriesInChart = Math.min(summaries.length, 10);
  const chartBoxHeight = 14 + maxCategoriesInChart * 7.5;
  ensureSpace(chartBoxHeight + 6);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, chartBoxHeight, 2.5, 2.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Category Distribution Chart (Annotation Counts & Share)', margin + 5, y + 7);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Showing top ${maxCategoriesInChart} of ${summaries.length} categories sorted by frequency`,
     contentWidth + margin - 5,
    y + 7,
    { align: 'right' }
  );

  const barPalette: [number, number, number][] = [
    [124, 58, 237], // violet
    [16, 185, 129], // emerald
    [245, 158, 11], // amber
    [14, 165, 233], // sky
  ];

  const maxCatCount = Math.max(...summaries.map((s) => s.count), 1);
  const labelColWidth = 38;
  const statsColWidth = 32;
  const maxBarTrackWidth = contentWidth - labelColWidth - statsColWidth - 14;

  summaries.slice(0, maxCategoriesInChart).forEach((cat, i) => {
    const rowY = y + 13 + i * 7.2;

    // Category label
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const truncatedName =
      cat.category.length > 18 ? cat.category.slice(0, 17) + '…' : cat.category;
    doc.text(truncatedName, margin + 5, rowY + 3.5);

    // Background track
    const trackX = margin + labelColWidth;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(trackX, rowY, maxBarTrackWidth, 4.6, 1.2, 1.2, 'F');

    // Filled bar
    const fillW = Math.max(2.5, (cat.count / maxCatCount) * maxBarTrackWidth);
    const color = barPalette[i % barPalette.length];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(trackX, rowY, fillW, 4.6, 1.2, 1.2, 'F');

    // Count & percentage
    doc.setTextColor(51, 65, 85);
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(
      `${cat.count} (${cat.percentage.toFixed(1)}%)`,
      margin + contentWidth - 5,
      rowY + 3.5,
      { align: 'right' }
    );
  });

  y += chartBoxHeight + 7;

  // 4. Side-by-Side Histograms: Area Distribution & Aspect Ratio Distribution
  const histHeight = 52;
  ensureSpace(histHeight + 6);

  const halfWidth = (contentWidth - 4) / 2;

  // Helper to draw vertical column histogram card
  const drawMiniHistogram = (
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    title: string,
    subtitle: string,
    bins: { label: string; count: number }[],
    barColor: [number, number, number]
  ) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, boxX + 4, boxY + 6.5);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(subtitle, boxX + boxW - 4, boxY + 6.5, { align: 'right' });

    if (!bins.length) {
      doc.setTextColor(148, 163, 184);
      doc.text('No data available', boxX + boxW / 2, boxY + boxH / 2, { align: 'center' });
      return;
    }

    const plotLeft = boxX + 5;
    const plotRight = boxX + boxW - 5;
    const plotBottom = boxY + boxH - 9;
    const plotTop = boxY + 13;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Baseline
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, plotBottom, plotRight, plotBottom);

    const maxBin = Math.max(...bins.map((b) => b.count), 1);
    const slotW = plotW / bins.length;
    const barW = Math.max(1.5, slotW * 0.68);

    bins.forEach((bin, idx) => {
      const bh = Math.max(1.2, (bin.count / maxBin) * plotH);
      const bx = plotLeft + idx * slotW + (slotW - barW) / 2;
      const by = plotBottom - bh;

      doc.setFillColor(barColor[0], barColor[1], barColor[2]);
      doc.rect(bx, by, barW, bh, 'F');

      if (bin.count > 0) {
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.text(String(bin.count), bx + barW / 2, by - 1, { align: 'center' });
      }

      // Show every 2nd or 3rd label to avoid crowding
      if (idx % 2 === 0 || idx === bins.length - 1) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.2);
        doc.text(bin.label, bx + barW / 2, plotBottom + 3.8, { align: 'center' });
      }
    });
  };

  drawMiniHistogram(
    margin,
    y,
    halfWidth,
    histHeight,
    `Bounding Box Area (${selectedCategory})`,
    'px² bins',
    areaBins,
    [124, 58, 237]
  );

  drawMiniHistogram(
    margin + halfWidth + 4,
    y,
    halfWidth,
    histHeight,
    `Aspect Ratio (${selectedCategory})`,
    'W / H ratio',
    aspectRatioBins,
    [16, 185, 129]
  );

  y += histHeight + 8;

  // 5. Category Summary Metrics Table
  ensureSpace(30);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Category Summary Metrics Table', margin, y);
  y += 3.5;

  const colWidths = [42, 20, 22, 28, 24, 23, 23]; // total = 182mm = contentWidth
  const headers = [
    'Category',
    'Count',
    'Share (%)',
    'Avg Area (px²)',
    'Avg AR',
    'Min Area',
    'Max Area',
  ];

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, topY, contentWidth, 7.5, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    let cx = margin + 3;
    headers.forEach((h, i) => {
      doc.text(h, cx, topY + 5);
      cx += colWidths[i];
    });
    return topY + 7.5;
  };

  y = drawTableHeader(y);

  summaries.forEach((row, idx) => {
    const rowH = 6.8;
    if (y + rowH > pageHeight - 16) {
      doc.addPage();
      y = 18;
      y = drawTableHeader(y);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, y, contentWidth, rowH, 'F');

    // Bottom row border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

    let cx = margin + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const catName = row.category.length > 21 ? row.category.slice(0, 20) + '…' : row.category;
    doc.text(catName, cx, y + 4.7);
    cx += colWidths[0];

    doc.setFont('courier', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text(String(row.count), cx, y + 4.7);
    cx += colWidths[1];

    doc.setFont('courier', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${row.percentage.toFixed(1)}%`, cx, y + 4.7);
    cx += colWidths[2];

    doc.text(row.avgArea.toLocaleString(), cx, y + 4.7);
    cx += colWidths[3];

    doc.text(String(row.avgAspectRatio), cx, y + 4.7);
    cx += colWidths[4];

    doc.setTextColor(100, 116, 139);
    doc.text(row.minArea.toLocaleString(), cx, y + 4.7);
    cx += colWidths[5];

    doc.text(row.maxArea.toLocaleString(), cx, y + 4.7);

    y += rowH;
  });

  // Add footer with page numbers on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Generated by Plum Image Tools — COCO Dataset Analytics Engine',
      margin,
      pageHeight - 6.5
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6.5, {
      align: 'right',
    });
  }

  const safeSlug = datasetTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);

  doc.save(`${safeSlug || 'coco_dataset'}_summary_report.pdf`);
}
