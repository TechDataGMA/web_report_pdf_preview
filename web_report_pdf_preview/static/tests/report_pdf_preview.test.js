// Copyright 2026 gmaOCR
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { afterEach, expect, test } from "@odoo/hoot";
import { queryOne } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    getService,
    mountWithCleanup,
    onRpc,
    patchWithCleanup,
} from "@web/../tests/web_test_helpers";

import { browser } from "@web/core/browser/browser";
import { MainComponentsContainer } from "@web/core/main_components_container";
import { download, downloadFile } from "@web/core/network/download";
import { downloadReport } from "@web/webclient/actions/reports/utils";

const PDF_ACTION = {
    type: "ir.actions.report",
    report_type: "qweb-pdf",
    report_name: "web_report_pdf_preview.dummy",
    report_file: "web_report_pdf_preview.dummy",
    name: "Dummy Report",
    context: { active_ids: [1] },
    data: null,
};

/**
 * Answers `/report/download` with a fake pdf, and lets every other route go
 * through the mocked network of the test suite.
 */
function mockReportDownload({ contentType = "application/pdf", status = 200 } = {}) {
    const originalFetch = browser.fetch;
    patchWithCleanup(browser, {
        fetch: (route, params) => {
            if (route !== "/report/download") {
                return originalFetch(route, params);
            }
            expect.step("/report/download");
            expect(params.method).toBe("POST");
            return new Response(new Blob(["%PDF-1.4 dummy"]), {
                status,
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": "attachment; filename*=UTF-8''Dummy%20Report.pdf",
                },
            });
        },
    });
}

afterEach(() => {
    // The wkhtmltopdf state is cached on the function itself.
    downloadReport.wkhtmltopdfStatusProm = null;
});

test("a pdf report opens the preview dialog", async () => {
    mockReportDownload();
    await mountWithCleanup(MainComponentsContainer);

    await getService("action").doAction(PDF_ACTION);
    await animationFrame();

    expect(".o_dialog .o_report_pdf_preview").toHaveCount(1);
    expect(".o_dialog header .modal-title").toHaveText("Dummy Report");
    // The test framework moves `t-att-src` to `t-att-data-src` on iframes so
    // that they never hit the network (see web/static/tests/_framework/mock_templates.hoot.js).
    expect(queryOne(".o_dialog iframe").getAttribute("data-src")).toMatch(
        /^\/web\/static\/lib\/pdfjs\/web\/viewer\.html\?file=blob/
    );
    expect.verifySteps(["/report/download"]);
});

test("the download button reuses the previewed pdf", async () => {
    mockReportDownload();
    patchWithCleanup(downloadFile, {
        _download: (data, filename, mimetype) => {
            expect(data).toBeInstanceOf(Blob);
            expect(filename).toBe("Dummy Report.pdf");
            expect(mimetype).toBe("application/pdf");
            expect.step("saved");
        },
    });
    await mountWithCleanup(MainComponentsContainer);

    await getService("action").doAction(PDF_ACTION);
    await animationFrame();
    await contains(".o_dialog footer button:contains(Download)").click();

    // A single /report/download: the pdf is not rendered again by the server.
    expect.verifySteps(["/report/download", "saved"]);
});

test("a report that cannot be rendered falls back on the standard flow", async () => {
    mockReportDownload({ contentType: "text/html", status: 500 });
    patchWithCleanup(download, {
        _download: () => {
            expect.step("standard download");
            return Promise.resolve();
        },
    });
    onRpc("/report/check_wkhtmltopdf", () => "ok");
    await mountWithCleanup(MainComponentsContainer);

    await getService("action").doAction(PDF_ACTION);
    await animationFrame();

    expect(".o_dialog").toHaveCount(0);
    expect.verifySteps(["/report/download", "standard download"]);
});

test("a text report is left to the standard flow", async () => {
    mockReportDownload();
    patchWithCleanup(download, {
        _download: () => {
            expect.step("standard download");
            return Promise.resolve();
        },
    });
    await mountWithCleanup(MainComponentsContainer);

    await getService("action").doAction({ ...PDF_ACTION, report_type: "qweb-text" });
    await animationFrame();

    expect(".o_dialog").toHaveCount(0);
    expect.verifySteps(["standard download"]);
});

test("the preview can be disabled through the context", async () => {
    mockReportDownload();
    patchWithCleanup(download, {
        _download: () => {
            expect.step("standard download");
            return Promise.resolve();
        },
    });
    onRpc("/report/check_wkhtmltopdf", () => "ok");
    await mountWithCleanup(MainComponentsContainer);

    await getService("action").doAction({
        ...PDF_ACTION,
        context: { ...PDF_ACTION.context, disable_pdf_preview: true },
    });
    await animationFrame();

    expect(".o_dialog").toHaveCount(0);
    expect.verifySteps(["standard download"]);
});
