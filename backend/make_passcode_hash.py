import getpass

import bcrypt

passcode = getpass.getpass("Enter passcode: ")
confirm = getpass.getpass("Confirm passcode: ")

if passcode != confirm:
    raise SystemExit("Passcodes do not match")
if len(passcode) < 8:
    raise SystemExit("Use at least 8 characters")
if len(passcode.encode()) > 72:
    raise SystemExit("Passcode is too long (72 bytes max)")

print(bcrypt.hashpw(passcode.encode(), bcrypt.gensalt()).decode())