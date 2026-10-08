"""Reject unknown fields; clients cannot submit a role, owner or status override."""
from datetime import datetime
import re
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator


def trim(value):
    return value.strip() if isinstance(value, str) else value


Text = Annotated[str, BeforeValidator(trim)]
Name = Annotated[Text, Field(min_length=1, max_length=80)]
Email = Annotated[Text, Field(min_length=5, max_length=120)]
Password = Annotated[str, Field(min_length=10, max_length=128)]
Distance = Annotated[float, Field(ge=0, le=500, allow_inf_nan=False)]
DriverStatus = Literal["Available", "Off duty", "Breakdown"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmailInput(Input):
    email: Email

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}", value):
            raise ValueError("Enter a valid email address, such as your Gmail address.")
        return value.lower()


class Account(EmailInput):
    name: Name
    password: Password


class Login(EmailInput):
    password: Annotated[str, Field(min_length=1, max_length=128)]
    role: Literal["admin", "driver"]


class DriverInput(EmailInput):
    name: Name
    phone: Annotated[Text, Field(min_length=1, max_length=25)]
    distanceKm: Distance
    vehicleId: Annotated[Text, Field(min_length=1, max_length=64)] | None = None
    status: DriverStatus | None = None
    password: Password | None = None


class VehicleInput(Input):
    registration: Annotated[Text, Field(min_length=1, max_length=25)]
    type: Literal["Cargo van", "Mini truck", "Pickup truck"]
    capacityKg: Annotated[float, Field(gt=0, le=100000, allow_inf_nan=False)]


class OrderInput(Input):
    customer: Annotated[Text, Field(min_length=1, max_length=100)]
    destination: Annotated[Text, Field(min_length=1, max_length=160)]
    pickup: Annotated[Text, Field(min_length=1, max_length=160)]
    weightKg: Annotated[float, Field(gt=0, le=100000, allow_inf_nan=False)]
    driverId: Annotated[Text, Field(min_length=1, max_length=64)]
    dueAt: datetime

    @field_validator("dueAt")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None:
            raise ValueError("Include a timezone in the delivery deadline.")
        return value


class ReportInput(Input):
    type: Literal["Engine failure", "Flat tyre", "Battery issue", "Vehicle damage", "Other mechanical issue"]
    urgency: Literal["High", "Normal", "Low"]
    location: Annotated[Text, Field(min_length=1, max_length=160)]
    description: Annotated[Text, Field(min_length=1, max_length=1500)]


class ReasonInput(Input):
    reason: Annotated[Text, Field(min_length=1, max_length=500)]


class AssignmentInput(Input):
    driverId: Annotated[Text, Field(min_length=1, max_length=64)]


class PlanProgress(Input):
    status: Literal["Accepted", "Picked up", "Completed"]


class OrderProgress(Input):
    status: Literal["In transit", "Delivered"]


class LocationInput(Input):
    location: Annotated[Text, Field(min_length=1, max_length=160)]


class StockInput(Input):
    name: Annotated[Text, Field(min_length=1, max_length=100)]
    category: Literal["Groceries", "Household", "Healthcare", "Other"]
    quantity: Annotated[int, Field(ge=0, le=1000000)]
    unit: Literal["boxes", "cartons", "units"]
    warehouse: Annotated[Text, Field(min_length=1, max_length=100)]

