// Copyright 2026 gmaOCR
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { Dialog } from "@web/core/dialog/dialog";
import { downloadFile } from "@web/core/network/download";
import { hidePDFJSButtons } from "@web/core/utils/pdfjs";

import { Component, onWillDestroy, useEffect, useRef } from "@odoo/owl";

/**
 * Displays an already rendered report in the pdf.js viewer shipped with Odoo.
 *
 * The pdf is kept as a blob so that printing and downloading it never asks the
 * server for a second rendering.
 */
export class ReportPdfPreviewDialog extends Component {
    static template = "web_report_pdf_preview.ReportPdfPreviewDialog";
    static components = { Dialog };
    static props = {
        blob: Blob,
        filename: String,
        title: String,
        close: Function,
    };

    setup() {
        this.objectUrl = URL.createObjectURL(this.props.blob);
        this.iframe = useRef("iframe");
        useEffect(
            (el) => {
                if (el) {
                    // Print and download are kept: they are the point of this
                    // dialog. Only the buttons that make no sense here ("Open
                    // File", "Current View", edition tools) are hidden.
                    hidePDFJSButtons(el);
                }
            },
            () => [this.iframe.el]
        );
        onWillDestroy(() => URL.revokeObjectURL(this.objectUrl));
    }

    get viewerUrl() {
        const file = encodeURIComponent(this.objectUrl);
        return `/web/static/lib/pdfjs/web/viewer.html?file=${file}#pagemode=none`;
    }

    onDownload() {
        downloadFile(this.props.blob, this.props.filename, "application/pdf");
    }

    onPrint() {
        this.iframe.el?.contentWindow.print();
    }
}
