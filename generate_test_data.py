#!/usr/bin/env python3
"""
Generate test Excel file from dummy data for GroupBuilder
Run this to create test_participants.xlsx
"""

from openpyxl import Workbook

# 20 participants - 17 from main three faiths, 4 singles, 8 couples
participants = [
    {"Name": "Jo Lee", "Religion": "Christian", "Gender": "Female", "Partner": "Sam Wu"},
    {"Name": "Sam Wu", "Religion": "Christian", "Gender": "Male", "Partner": "Jo Lee"},
    {"Name": "Li Chen", "Religion": "Muslim", "Gender": "Female", "Partner": None},
    {"Name": "Sarah Cohen", "Religion": "Jewish", "Gender": "Female", "Partner": "David Cohen"},
    {"Name": "David Cohen", "Religion": "Jewish", "Gender": "Male", "Partner": "Sarah Cohen"},
    {"Name": "Raj Patel", "Religion": "Hindu", "Gender": "Male", "Partner": None},
    {"Name": "Maria Rodriguez", "Religion": "Christian", "Gender": "Female", "Partner": "Carlos Rodriguez"},
    {"Name": "Carlos Rodriguez", "Religion": "Christian", "Gender": "Male", "Partner": "Maria Rodriguez"},
    {"Name": "Aisha Hassan", "Religion": "Muslim", "Gender": "Female", "Partner": "Omar Hassan"},
    {"Name": "Omar Hassan", "Religion": "Muslim", "Gender": "Male", "Partner": "Aisha Hassan"},
    {"Name": "Emma Thompson", "Religion": "Christian", "Gender": "Female", "Partner": None},
    {"Name": "Noah Kim", "Religion": "Christian", "Gender": "Male", "Partner": None},
    {"Name": "Rebecca Goldstein-Meyer", "Religion": "Jewish", "Gender": "Female", "Partner": "Michael Goldstein-Meyer"},
    {"Name": "Michael Goldstein-Meyer", "Religion": "Jewish", "Gender": "Male", "Partner": "Rebecca Goldstein-Meyer"},
    {"Name": "Fatima Al-Rashid", "Religion": "Muslim", "Gender": "Female", "Partner": "Ahmed Al-Rashid"},
    {"Name": "Ahmed Al-Rashid", "Religion": "Muslim", "Gender": "Male", "Partner": "Fatima Al-Rashid"},
    {"Name": "Christopher Montgomery-Wellington", "Religion": "Jewish", "Gender": "Male", "Partner": "Elizabeth Montgomery-Wellington"},
    {"Name": "Elizabeth Montgomery-Wellington", "Religion": "Jewish", "Gender": "Female", "Partner": "Christopher Montgomery-Wellington"},
    {"Name": "Yuki Tanaka", "Religion": "Buddhist", "Gender": "Female", "Partner": "Kenji Tanaka"},
    {"Name": "Kenji Tanaka", "Religion": "None", "Gender": "Male", "Partner": "Yuki Tanaka"},
]

# Create workbook and get active sheet
wb = Workbook()
ws = wb.active
ws.title = "Participants"

# Add headers
headers = ["Name", "Religion", "Gender", "Partner"]
ws.append(headers)

# Add participant data
for p in participants:
    ws.append([
        p["Name"],
        p["Religion"],
        p["Gender"],
        p.get("Partner", "")
    ])

# Save to Excel
output_file = "test_participants.xlsx"
wb.save(output_file)

print(f"✓ Created {output_file}")
print(f"  - {len(participants)} participants")
print(f"  - {len([p for p in participants if p.get('Partner')])} partnered (8 couples)")
print(f"  - {len([p for p in participants if not p.get('Partner')])} singles")
print(f"\nReligion breakdown:")
religions = {}
for p in participants:
    rel = p["Religion"]
    religions[rel] = religions.get(rel, 0) + 1

for religion in sorted(religions.keys()):
    print(f"  - {religion}: {religions[religion]}")
