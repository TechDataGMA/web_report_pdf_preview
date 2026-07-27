// Copyright 2026 gmaOCR
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { getReportUrl } from "@web/webclient/actions/reports/utils";

import { ReportPdfPreviewDialog } from "./report_pdf_preview_dialog";

/**
 * Reads the filename advertised by `/report/download`. That controller builds it
 * with `odoo.http.content_disposition`, which emits the RFC 6266 extended form
 * (`filename*=UTF-8''...`).
 *
 * @param {Response} response
 * @param {string} fallback used when the header is missing or unparsable
 * @returns {string}
 */
function getReportFilename(response, fallback) {
    const header = response.headers.get("content-disposition") || "";
    const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (extended) {
        try {
            return decodeURIComponent(extended[1]);
        } catch {
            // A malformed header must not prevent the preview from opening.
        }
    }
    const simple = /filename="?([^";]+)"?/i.exec(header);
    return simple ? simple[1] : fallback;
}

/**
 * Renders the report through the very same controller as the standard flow, but
 * keeps the response instead of saving it to disk.
 *
 * @param {Object} action
 * @param {Object} env
 * @returns {Promise<Response|false>} false when the request itself failed
 */
async function fetchReportPdf(action, env) {
    const formData = new FormData();
    formData.append("data", JSON.stringify([getReportUrl(action, "pdf"), action.report_type]));
    formData.append("context", JSON.stringify({ ...user.context, ...action.context }));
    formData.append("token", "dummy-because-api-expects-one");
    if (odoo.csrf_token) {
        formData.append("csrf_token", odoo.csrf_token);
    }
    env.services.ui.block();
    try {
        return await browser.fetch("/report/download", { method: "POST", body: formData });
    } catch {
        return false;
    } finally {
        env.services.ui.unblock();
    }
}

/**
 * Opens the pdf of a report action in a preview dialog instead of downloading it.
 *
 * Returning a falsy value hands the action back to the standard flow of
 * `ir.actions.report`, so any report this handler does not take care of keeps
 * its original behaviour.
 *
 * @param {Object} action
 * @param {Object} options
 * @param {Object} env
 * @returns {Promise<boolean>}
 */
export async function reportPdfPreviewHandler(action, options, env) {
    if (
        action.report_type !== "qweb-pdf" ||
        // An IoT printer is selected for that report: it is printed, not previewed.
        action.device_ids?.length ||
        action.context?.disable_pdf_preview
    ) {
        return false;
    }
    const response = await fetchReportPdf(action, env);
    const contentType = (response && response.headers.get("content-type")) || "";
    if (!response || !response.ok || !contentType.includes("application/pdf")) {
        // The pdf could not be rendered (wkhtmltopdf missing or broken, error
        // raised by the report, ...). The standard flow knows how to report the
        // error and how to fall back on the html version of the report.
        return false;
    }
    env.services.dialog.add(ReportPdfPreviewDialog, {
        title: action.display_name || action.name || _t("Report"),
        blob: await response.blob(),
        filename: getReportFilename(response, `${action.report_file || action.report_name}.pdf`),
    });
    return true;
}

// Sequence 100 keeps this handler behind the ones that actually print the report
// (`iot` registers itself with the default sequence).
registry
    .category("ir.actions.report handlers")
    .add("web_report_pdf_preview", reportPdfPreviewHandler, { sequence: 100 });
