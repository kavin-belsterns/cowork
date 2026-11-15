-- E-001/S-14: app_web may delete office_hours (AC-54) and booking_series (AC-74 to AC-77).
GRANT DELETE ON "office_hours", "booking_series" TO "app_web";
