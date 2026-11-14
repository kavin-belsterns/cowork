# Room booking workflows

This file shows the main journeys in the room booking app.

## Any role signs in

Any user signs in and lands on the right page. A forced password change comes first.
The journey is the same for every role. Only the landing page differs.

```mermaid
flowchart TD
  A[User opens the sign-in page] --> B[User sends email and password]
  B --> B2{Too many accounts failed from this network address?}
  B2 -->|Yes| D[Show: Too many attempts. Try again in 15 minutes.]
  B2 -->|No| C{5 or more failures on this account in the last 15 minutes?}
  C -->|Yes| D
  C -->|No| E{Details correct?}
  E -->|No| F[Show: Email or password is wrong.]
  E -->|Yes| G{Account active and temporary password not expired?}
  G -->|No| H[Show the account message]
  G -->|Yes| I{Must change password?}
  I -->|Yes| J[Open the password page]
  J --> K[User saves a new password of 12 or more characters]
  K --> L[Open the role home]
  I -->|No| L
  L --> M[Session runs 12 hours]
  M --> N[Warning 5 minutes before the end]
  N --> A
```

| Role | Role home |
|---|---|
| Platform admin | Offices |
| Office admin | Reception |
| Receptionist | Reception |
| Employee | Rooms |

Related rules: E-001/AC-47, AC-48, AC-49, AC-71, AC-72, AC-84, AC-85.
