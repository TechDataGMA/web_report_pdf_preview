# Copyright 2026 TechData
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestGetPdfPreviewReports(TransactionCase):
    def _create_report(self, name: str, report_type: str) -> object:
        return self.env["ir.actions.report"].create(
            {
                "name": name,
                "model": "res.partner",
                "report_type": report_type,
                "report_name": f"web_report_pdf_preview.{name}",
                "binding_model_id": self.env["ir.model"]._get_id("res.partner"),
                "binding_type": "report",
            }
        )

    def test_returns_bound_pdf_reports_only(self) -> None:
        """Only the qweb-pdf reports of the print menu are previewable."""
        pdf_report = self._create_report("preview_pdf", "qweb-pdf")
        html_report = self._create_report("preview_html", "qweb-html")
        self.env.registry.clear_cache()

        names = [
            report["name"]
            for report in self.env["ir.actions.report"].get_pdf_preview_reports("res.partner")
        ]

        self.assertIn(pdf_report.name, names, "a bound qweb-pdf report must be previewable")
        self.assertNotIn(html_report.name, names, "a qweb-html report has nothing to preview")

    def test_ignores_reports_of_another_model(self) -> None:
        """A report bound to another model must not leak into the list."""
        self._create_report("preview_pdf", "qweb-pdf")
        self.env.registry.clear_cache()

        names = [
            report["name"]
            for report in self.env["ir.actions.report"].get_pdf_preview_reports("res.users")
        ]

        self.assertNotIn("preview_pdf", names)
