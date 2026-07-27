// Copyright 2026 TechData
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { browser } from "@web/core/browser/browser";
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
 * Renders the report through the very same controller as the print flow, but
 * keeps the response instead of saving it to disk.
 *
 * @param {Object} reportAction
 * @param {Object} env
 * @returns {Promise<Response|false>} false when the request itself failed
 */
async function fetchReportPdf(reportAction, env) {
    const formData = new FormData();
    formData.append(
        "data",
        JSON.stringify([getReportUrl(reportAction, "pdf"), reportAction.report_type])
    );
    formData.append("context", JSON.stringify({ ...user.context, ...reportAction.context }));
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
 * Renders `report` for `context` and opens it in the preview dialog.
 *
 * @param {Object} env
 * @param {Object} report id, name, report_name and report_file of the report
 * @param {Object} context context of the print, holding the active ids
 * @returns {Promise<boolean>} false when the pdf could not be rendered, so that
 *      the caller can hand the report over to the standard print flow
 */
export async function openReportPdfPreview(env, report, context) {
    const reportAction = {
        report_name: report.report_name,
        report_file: report.report_file,
        report_type: "qweb-pdf",
        context,
        data: null,
    };
    const response = await fetchReportPdf(reportAction, env);
    const contentType = (response && response.headers.get("content-type")) || "";
    if (!response || !response.ok || !contentType.includes("application/pdf")) {
        return false;
    }
    env.services.dialog.add(ReportPdfPreviewDialog, {
        title: report.name,
        blob: await response.blob(),
        filename: getReportFilename(response, `${report.report_file || report.report_name}.pdf`),
    });
    return true;
}
