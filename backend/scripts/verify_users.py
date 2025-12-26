from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def verify_users():
    db = SessionLocal()
    try:
        print("Checking for users...")
        users = db.query(User).all()
        print(f"Total users found: {len(users)}")
        
        admin = db.query(User).filter(User.email == "admin@edwards.com").first()
        if admin:
            print(f"Admin user found: {admin.email}")
            print(f"Current password hash: {admin.hashed_password}")
            
            # Reset password to ensure it's correct with current bcrypt version
            new_hash = get_password_hash("password")
            admin.hashed_password = new_hash
            db.commit()
            print("Admin password reset to 'password' with current bcrypt version.")
        else:
            print("Admin user NOT found.")
            
        gerald = db.query(User).filter(User.email == "gerald.park@edwardsvacuum.com").first()
        if gerald:
             print(f"User Gerald found: {gerald.email}")
             # Reset password for Gerald too if needed, or just report
             # Assuming default password might be 'password' based on seeding logic?
             # But initial data doesn't explicitly seed Gerald with a password in the visible part, 
             # usually it loops through members.
             pass
        else:
            print("User Gerald NOT found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_users()
