from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, default="General")
    is_active = Column(Boolean, default=True)
    
    sessions = relationship("Session", back_populates="user")


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ip_address = Column(String)
    user_agent = Column(String)
    network_isp = Column(String)
    network_recognized = Column(Boolean, default=False)
    initial_trust_score = Column(Float)
    trust_score = Column(Float)
    started_at = Column(DateTime, default=func.now())
    last_active_at = Column(DateTime, default=func.now(), onupdate=func.now())
    status = Column(String, default="active")
    lat = Column(Float)
    lon = Column(Float)
    
    user = relationship("User", back_populates="sessions")


class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
