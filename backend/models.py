from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, func
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
    network_events = relationship("NetworkEvent", back_populates="user")


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
    
    # Continuous network monitoring telemetry
    network_risk_score = Column(Float, default=0.0)
    device_fingerprint = Column(Text, default="{}")
    asn = Column(String, default="Unknown")
    is_vpn = Column(Boolean, default=False)
    is_tor = Column(Boolean, default=False)
    is_proxy = Column(Boolean, default=False)
    is_datacenter = Column(Boolean, default=False)
    avg_latency_ms = Column(Float, default=0.0)
    jitter_ms = Column(Float, default=0.0)
    reconnect_count = Column(Integer, default=0)
    
    user = relationship("User", back_populates="sessions")
    network_events = relationship("NetworkEvent", back_populates="session")


class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)


class NetworkEvent(Base):
    __tablename__ = "network_events"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    event_type = Column(String, nullable=False)  # e.g., "IMPOSSIBLE_TRAVEL", "IP_CHANGE", "TOR_DETECTED", "VPN_DETECTED", "DEVICE_DRIFT", "NETWORK_VERIFIED"
    severity = Column(String, default="low")     # "info", "low", "medium", "high", "critical"
    risk_score = Column(Float, default=0.0)
    ip_address = Column(String, nullable=True)
    location = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    
    session = relationship("Session", back_populates="network_events")
    user = relationship("User", back_populates="network_events")


class CorporateAllowlist(Base):
    __tablename__ = "corporate_network_allowlist"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entry_type = Column(String, nullable=False)  # "ISP", "ASN", "IP", "CIDR"
    value = Column(String, nullable=False, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
