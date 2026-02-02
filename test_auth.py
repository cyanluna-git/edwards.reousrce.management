import sys
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed = "$2b$12$5RlDOAzIuP2ul6Ze5QdsM.9iddSnqUaL/ne39LpLiwzBY7ZT7ztAy"
plain = "password"

try:
    result = pwd_context.verify(plain, hashed)
    print(f"Verification result: {result}")
except Exception as e:
    print(f"Error during verification: {e}")
    sys.exit(1)
