from docx import Document

file_path = "Log Sheet.docx"
doc = Document(file_path)
new_lines = [
    "",
    "",
    "",
    "Department of Computer Science and Engineering\t",
    "WEEKLY LOG-SHEET\t",
    "",
    "",
    " Task Description: Project Wrap-up & Finalization",
    " Date: 27/07/2026",
    "",
    " Activities Completed:",
    " - Finalized collaborative editor and realtime sync across users.",
    " - Completed GitHub repository integration and commit workflows.",
    " - Resolved remaining bugs and polished UI/UX across the app.",
    " - Prepared the final demo, documentation, and project handover notes.",
    "",
    "_________________________",
    "",
    "       Signature of Students ",
    "             (Each Students)\t",
    "_________________________",
    "Supervisor Signature\t "
]
for line in new_lines:
    doc.add_paragraph(line)

doc.save(file_path)
print(f"Updated {file_path}")
