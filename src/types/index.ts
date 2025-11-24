import { z } from 'zod';

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  PostRequest: undefined;
  MyRequests: undefined;
  Notifications: undefined;
  Safety: undefined;
  Profile: undefined;
  AccountVerification: undefined;
  PhoneVerification: { phoneNumber: string };
  EmergencyContacts: undefined;
  RideVerification: undefined;
  RideDetails: { ride: Ride };
  FindMatches: { requestId: string };
  MatchDetails: { matchId: string };
  GroupChat: { matchId: string };
};

// Location types
export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationWithAddress extends Location {
  address: string;
  geohash?: string;
}

// User types and schemas
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().min(10, 'Valid phone number required'),
  university: z.string().min(1, 'University is required'),
  studentId: z.string().optional(),
  isVerified: z.boolean().default(false),
  isStudentVerified: z.boolean().default(false),
  isPhoneVerified: z.boolean().default(false),
  emailVerifiedAt: z.date().optional(),
  studentVerifiedAt: z.date().optional(),
  phoneVerifiedAt: z.date().optional(),
  profileImageUrl: z.string().url().optional(),
  rating: z.number().min(0).max(5).default(0),
  totalRides: z.number().default(0),
  emergencyContacts: z.array(z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
    relationship: z.string().min(1)
  })).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Ride types and schemas
export const RideStatusSchema = z.enum(['active', 'completed', 'cancelled', 'in_progress']);
export type RideStatus = z.infer<typeof RideStatusSchema>;

export const RideSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driver: UserSchema.optional(), // Populated in queries
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  origin: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    geohash: z.string()
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    geohash: z.string()
  }),
  departureTime: z.date(),
  availableSeats: z.number().min(1).max(8),
  pricePerSeat: z.number().min(0),
  status: RideStatusSchema,
  preferences: z.object({
    smokingAllowed: z.boolean().default(false),
    petsAllowed: z.boolean().default(false),
    musicAllowed: z.boolean().default(true),
    genderPreference: z.enum(['any', 'female_only', 'male_only']).default('any')
  }).default({}),
  safetyFeatures: z.object({
    shareLocationWithContacts: z.boolean().default(true),
    requireVerifiedStudents: z.boolean().default(false),
    enableSOSButton: z.boolean().default(true)
  }).default({}),
  passengerIds: z.array(z.string()).default([]),
  passengers: z.array(UserSchema).optional(), // Populated in queries
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Ride = z.infer<typeof RideSchema>;

// Ride Request types and schemas
export const RequestStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'cancelled']);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const RideRequestSchema = z.object({
  id: z.string(),
  rideId: z.string(),
  passengerId: z.string(),
  passenger: UserSchema.optional(), // Populated in queries
  message: z.string().optional(),
  seatsRequested: z.number().min(1).max(4),
  status: RequestStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RideRequest = z.infer<typeof RideRequestSchema>;

// AIUB Email validation helper
const AIUB_STUDENT_EMAIL_REGEX = /^\d{2}-\d{5}-\d{1}@student\.aiub\.edu$/;
const AIUB_FACULTY_EMAIL_REGEX = /^[a-z]\.[a-z]+@aiub\.edu$/;

const isValidAIUBEmail = (email: string): boolean => {
  return AIUB_STUDENT_EMAIL_REGEX.test(email) || AIUB_FACULTY_EMAIL_REGEX.test(email);
};

// Form schemas for validation
export const LoginFormSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .refine(
      (email) => isValidAIUBEmail(email),
      'Email must be a valid AIUB email (e.g., 12-34567-1@student.aiub.edu or name.surname@aiub.edu)'
    ),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export type LoginForm = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string()
    .email('Invalid email address')
    .refine(
      (email) => isValidAIUBEmail(email),
      'Email must be a valid AIUB email (e.g., 12-34567-1@student.aiub.edu or name.surname@aiub.edu)'
    ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  phoneNumber: z.string().min(10, 'Valid phone number required'),
  university: z.string().min(1, 'University is required').default('American International University-Bangladesh (AIUB)')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export type RegisterForm = z.infer<typeof RegisterFormSchema>;

export const PostRideFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  originAddress: z.string().min(1, 'Origin address is required'),
  destinationAddress: z.string().min(1, 'Destination address is required'),
  departureTime: z.date().min(new Date(), 'Departure time must be in the future'),
  availableSeats: z.number().min(1, 'At least 1 seat required').max(8, 'Maximum 8 seats'),
  pricePerSeat: z.number().min(0, 'Price cannot be negative'),
  smokingAllowed: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  musicAllowed: z.boolean().default(true),
  genderPreference: z.enum(['any', 'female_only', 'male_only']).default('any'),
  shareLocationWithContacts: z.boolean().default(true),
  requireVerifiedStudents: z.boolean().default(false)
});

export type PostRideForm = z.infer<typeof PostRideFormSchema>;

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Chat types (for future implementation)
export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'location' | 'system';
}

// Safety types (for future implementation)
export interface EmergencyAlert {
  id: string;
  userId: string;
  rideId?: string;
  location: Location;
  message: string;
  status: 'active' | 'resolved';
  createdAt: Date;
}