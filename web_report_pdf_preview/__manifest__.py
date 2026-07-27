# Copyright 2026 TechData
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "PDF Report Preview",
    "summary": "Preview PDF reports in a dialog before printing or downloading them",
    "version": "19.0.1.0.0",
    "category": "Technical",
    "author": "TechData",
    "maintainer": "TechData",
    "website": "https://github.com/TechDataGMA/web_report_pdf_preview",
    "license": "AGPL-3",
    "depends": ["web"],
    "assets": {
        "web.assets_backend": [
            "web_report_pdf_preview/static/src/**/*",
        ],
        "web.assets_unit_tests": [
            "web_report_pdf_preview/static/tests/**/*",
        ],
    },
    "installable": True,
}
