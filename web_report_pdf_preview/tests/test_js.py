# Copyright 2026 TechData
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
import odoo
from odoo.addons.web.tests.test_js import unit_test_error_checker


@odoo.tests.tagged("post_install", "-at_install")
class TestReportPdfPreviewSuite(odoo.tests.HttpCase):
    def test_unit_report_pdf_preview(self) -> None:
        """Run the hoot suite of this module in a headless browser."""
        self.browser_js(
            "/web/tests"
            "?headless&loglevel=2&preset=desktop&timeout=15000"
            "&filter=web_report_pdf_preview",
            "",
            "",
            login="admin",
            timeout=600,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=unit_test_error_checker,
        )
