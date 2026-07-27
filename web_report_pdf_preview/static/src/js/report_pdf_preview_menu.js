// Copyright 2026 gmaOCR
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { session } from "@web/session";
import { ActionMenus } from "@web/search/action_menus/action_menus";

import { openReportPdfPreview } from "./report_pdf_preview";

patch(ActionMenus.prototype, {
    /**
     * Adds a preview entry next to each pdf report of the print dropdown. The
     * native entries keep their own behaviour: printing is left untouched.
     */
    async loadAvailablePrintItems() {
        const items = await super.loadAvailablePrintItems();
        if (!items.length) {
            return items;
        }
        // Report definitions are not readable by regular users, hence the
        // dedicated method instead of a plain read.
        const reports = await this.orm.call("ir.actions.report", "get_pdf_preview_reports", [
            this.props.resModel,
        ]);
        const previewables = new Map(reports.map((report) => [report.id, report]));
        return items.flatMap((item) => {
            const report = previewables.get(item.action?.id);
            if (!report) {
                return [item];
            }
            return [
                item,
                {
                    class: "o_menu_item",
                    description: _t("Preview: %(report)s", { report: item.description }),
                    key: `${item.key}_pdf_preview`,
                    callback: () => this.previewPdfReport(item.action, report),
                },
            ];
        });
    },

    /**
     * @param {Object} action report action of the native print entry
     * @param {Object} report id, name and template of that report
     */
    async previewPdfReport(action, report) {
        // Same active ids resolution as `executeAction`, which the native print
        // entry goes through.
        let activeIds = this.props.getActiveIds();
        if (this.props.isDomainSelected) {
            activeIds = await this.orm.search(this.props.resModel, this.props.domain, {
                limit: session.active_ids_limit,
                context: this.props.context,
            });
        }
        const context = {
            ...this.props.context,
            active_id: activeIds[0],
            active_ids: activeIds,
            active_model: this.props.resModel,
        };
        if (!(await openReportPdfPreview(this.env, report, context))) {
            // The pdf could not be rendered (wkhtmltopdf missing or broken,
            // error raised by the report, ...): hand the report over to the
            // standard flow, which reports the error and degrades to html.
            await this.executeAction(action);
        }
    },
});
