export function validateName(name: string): string | null {
  if (!name.trim()) return "Name is required.";
  if (name.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone) return "Phone number is required.";
  if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits.";
  return null;
}

export function validateDOB(dob: string): string | null {
  if (!dob) return "Date of birth is required.";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "Invalid date.";
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  const exactAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
  if (exactAge < 18) return "You must be at least 18 years old to register.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  if (!/^[a-zA-Z0-9._%+\-]+@gmail\.com$/i.test(email)) {
    return "Email must be a valid @gmail.com address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&* etc).";
  }
  return null;
}

export function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score++;
  return score;
}
