# Copyright 2026 gmaOCR
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
from odoo import api, models


class IrActionsReport(models.Model):
    _inherit = "ir.actions.report"

    @api.model
    def get_pdf_preview_reports(self, model_name: str) -> list[dict]:
        """Return the qweb-pdf reports of the print menu of ``model_name``.

        Report definitions are only readable by ``group_system`` (see the access
        rights of ``base``), which is why ``get_bindings`` reads them as sudo.
        This method builds on it, so it exposes exactly the reports the user
        already sees in the print menu: same group filtering, same check on the
        model access rights. Only the fields needed to build the preview url are
        returned.
        """
        bindings = self.env["ir.actions.actions"].get_bindings(model_name).get("print", [])
        reports = self.sudo().browse([binding["id"] for binding in bindings]).exists()
        return [
            {
                "id": report.id,
                "name": report.name,
                "report_name": report.report_name,
                "report_file": report.report_file,
            }
            for report in reports
            if report.report_type == "qweb-pdf"
        ]
