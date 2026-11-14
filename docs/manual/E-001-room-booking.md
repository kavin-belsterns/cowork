# Room booking manual

This manual explains how each role uses the room booking app.
Each block covers one task.

## Sign in and passwords

Every user signs in with an email and a password. The app then opens the page the user asked for, when it is a safe page inside the app.
If there is none, the app opens the home page for the user's role.
A wrong password never reveals which part was wrong.

### Where each role lands

| Role | Home page |
|---|---|
| Platform admin | Offices |
| Office admin | Reception |
| Receptionist | Reception |
| Employee | Rooms |

### If sign in fails

| What you see | What it means | What to do |
|---|---|---|
| Email or password is wrong. | The details do not match. | Check both and try again. |
| Too many attempts. Try again in 15 minutes. | One account had **5** wrong tries in the last 15 minutes. Or many different accounts failed from the same network address. | Wait. The block lifts when the failures fall out of the 15 minute window. |
| This account is not active. | The office admin turned the account off. | Ask the office admin. |
| This temporary password has expired. Ask your admin for a new one. | The temporary password ran out. | Ask the office admin for a new one. |

### Forced password change

A new user or a reset user signs in with a temporary password.
The app then opens the password page first.
The user cannot reach any other page until a new password is saved.

### Choosing a password

A new password needs 12 to 128 characters.
A shorter one shows "Use at least 12 characters."

### When a session ends

A session ends 12 hours after sign in. Activity does not extend it.
A warning shows 5 minutes before the end: "Your session ends in 5 minutes. Save your work, then sign in again."
After the end, sign in again.

### Forgotten password

A user cannot reset a forgotten password alone.
Ask the office admin to reset it.
The admin gives a temporary password, and the forced change applies.
