import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  createRide,
  getRide,
  getRides,
  getRidesNearLocation,
  updateRide,
  deleteRide,
  cancelRide,
  addPassengerToRide,
  removePassengerFromRide,
  CreateRideData,
  GetRidesParams,
} from '../services/ridesService';
import { Location, Ride } from '@/types';

// Query keys
export const RIDE_QUERY_KEYS = {
  all: ['rides'] as const,
  lists: () => [...RIDE_QUERY_KEYS.all, 'list'] as const,
  list: (params: GetRidesParams) => [...RIDE_QUERY_KEYS.lists(), params] as const,
  near: (location: Location, radius: number) => 
    [...RIDE_QUERY_KEYS.all, 'near', location, radius] as const,
  details: () => [...RIDE_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...RIDE_QUERY_KEYS.details(), id] as const,
  userRides: (userId: string) => [...RIDE_QUERY_KEYS.all, 'user', userId] as const,
};

// Get rides with optional filtering
export const useRides = (params: GetRidesParams = {}) => {
  return useQuery({
    queryKey: RIDE_QUERY_KEYS.list(params),
    queryFn: () => getRides(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

// Get rides near a specific location
export const useRidesNearLocation = (location: Location | null, radiusKm: number = 10) => {
  return useQuery({
    queryKey: RIDE_QUERY_KEYS.near(location!, radiusKm),
    queryFn: () => getRidesNearLocation(location!, radiusKm),
    enabled: !!location,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

// Get a specific ride by ID
export const useRide = (rideId: string | null) => {
  return useQuery({
    queryKey: RIDE_QUERY_KEYS.detail(rideId!),
    queryFn: () => getRide(rideId!),
    enabled: !!rideId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Get rides created by the current user
export const useUserRides = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: RIDE_QUERY_KEYS.userRides(user?.uid || ''),
    queryFn: () => getRides({ driverId: user?.uid }),
    enabled: !!user?.uid,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Create a new ride
export const useCreateRide = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateRideData) => {
      if (!user?.uid) {
        throw new Error('User must be authenticated to create a ride');
      }
      return createRide(data, user.uid);
    },
    onSuccess: () => {
      // Invalidate and refetch rides
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.all });
    },
    onError: (error) => {
      console.error('Create ride error:', error);
    },
  });
};

// Update an existing ride
export const useUpdateRide = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rideId, updates }: { rideId: string; updates: Partial<Ride> }) =>
      updateRide(rideId, updates),
    onSuccess: (_, { rideId }) => {
      // Invalidate the specific ride and all ride lists
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.lists() });
    },
    onError: (error) => {
      console.error('Update ride error:', error);
    },
  });
};

// Delete a ride
export const useDeleteRide = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rideId: string) => deleteRide(rideId),
    onSuccess: (_, rideId) => {
      // Remove the ride from cache and invalidate lists
      queryClient.removeQueries({ queryKey: RIDE_QUERY_KEYS.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.lists() });
    },
    onError: (error) => {
      console.error('Delete ride error:', error);
    },
  });
};

// Cancel a ride
export const useCancelRide = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rideId: string) => cancelRide(rideId),
    onSuccess: (_, rideId) => {
      // Invalidate the specific ride and all ride lists
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.lists() });
    },
    onError: (error) => {
      console.error('Cancel ride error:', error);
    },
  });
};

// Add passenger to ride (for drivers)
export const useAddPassenger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rideId, passengerId }: { rideId: string; passengerId: string }) =>
      addPassengerToRide(rideId, passengerId),
    onSuccess: (_, { rideId }) => {
      // Invalidate the specific ride
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.lists() });
    },
    onError: (error) => {
      console.error('Add passenger error:', error);
    },
  });
};

// Remove passenger from ride
export const useRemovePassenger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rideId, passengerId }: { rideId: string; passengerId: string }) =>
      removePassengerFromRide(rideId, passengerId),
    onSuccess: (_, { rideId }) => {
      // Invalidate the specific ride
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.detail(rideId) });
      queryClient.invalidateQueries({ queryKey: RIDE_QUERY_KEYS.lists() });
    },
    onError: (error) => {
      console.error('Remove passenger error:', error);
    },
  });
};