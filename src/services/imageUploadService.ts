import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/config/firebaseConfig';
import { Alert, Platform } from 'react-native';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Request camera and media library permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  try {
    // Request camera permission
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    // Request media library permission
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status !== 'granted' || mediaPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera and photo library access are needed to upload profile pictures.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
};

/**
 * Pick an image from the device library
 */
export const pickImageFromLibrary = async (): Promise<string | null> => {
  try {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Error picking image from library:', error);
    Alert.alert('Error', 'Failed to pick image from library');
    return null;
  }
};

/**
 * Take a photo using the device camera
 */
export const takePhotoWithCamera = async (): Promise<string | null> => {
  try {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return null;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo');
    return null;
  }
};

/**
 * Upload image to Firebase Storage
 */
export const uploadImageToStorage = async (
  imageUri: string,
  userId: string,
  folder: 'profile_pictures' | 'chat_images' = 'profile_pictures'
): Promise<ImageUploadResult> => {
  try {
    console.log('Starting image upload...', { imageUri, userId, folder });
    
    // Validate storage is initialized
    if (!storage) {
      console.error('❌ Firebase Storage is not initialized - Storage may not be enabled in Firebase Console');
      return {
        success: false,
        error: 'Storage not enabled. Please enable Firebase Storage in Firebase Console:\n1. Go to Firebase Console\n2. Click Storage\n3. Click Get Started\n4. Choose location and enable',
      };
    }
    
    console.log('✅ Storage instance exists:', !!storage);
    console.log('Storage bucket:', storage.app?.options?.storageBucket);

    // Convert image URI to blob
    console.log('Fetching image...');
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('Image fetched, size:', blob.size, 'bytes');

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${folder}/${userId}_${timestamp}.jpg`;
    console.log('Uploading to:', filename);

    // Create storage reference
    const storageRef = ref(storage, filename);

    // Upload image with metadata
    const metadata = {
      contentType: 'image/jpeg',
    };

    console.log('Uploading bytes...');
    const uploadResult = await uploadBytes(storageRef, blob, metadata);
    console.log('Upload successful:', uploadResult.metadata.fullPath);

    // Get download URL
    console.log('Getting download URL...');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL obtained:', downloadURL);

    return {
      success: true,
      url: downloadURL,
    };
  } catch (error: any) {
    console.error('Error uploading image:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      serverResponse: error.serverResponse,
    });
    
    let errorMessage = 'Failed to upload image. Please try again.';
    
    if (error.code === 'storage/unauthorized') {
      errorMessage = '❌ Permission denied.\n\nFix: Update Storage Rules in Firebase Console:\n\nrules_version = \'2\';\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{allPaths=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Upload was cancelled.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = '❌ Storage not enabled!\n\nTO FIX:\n1. Go to Firebase Console\n2. Click Storage in sidebar\n3. Click "Get Started"\n4. Choose location: asia-south1\n5. Click Done\n6. Restart app';
    } else if (error.message?.includes('not initialized')) {
      errorMessage = '❌ Storage not enabled in Firebase Console.\n\nPlease enable it first, then restart the app.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Delete image from Firebase Storage
 */
export const deleteImageFromStorage = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract file path from URL
    const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
    if (!imageUrl.startsWith(baseUrl)) {
      console.warn('Invalid storage URL');
      return false;
    }

    // Parse the URL to get the file path
    const urlParts = imageUrl.split('/o/');
    if (urlParts.length < 2) {
      console.warn('Could not parse storage URL');
      return false;
    }

    const pathWithParams = urlParts[1];
    const filePath = decodeURIComponent(pathWithParams.split('?')[0]);

    // Create storage reference and delete
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

/**
 * Show image picker action sheet
 */
export const showImagePickerOptions = (): Promise<'camera' | 'library' | null> => {
  return new Promise((resolve) => {
    Alert.alert(
      'Choose Profile Picture',
      'Select an option to upload your profile picture',
      [
        {
          text: 'Take Photo',
          onPress: () => resolve('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => resolve('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ],
      { cancelable: true, onDismiss: () => {
        try {
          resolve(null);
        } catch (error) {
          console.log('Alert dismiss error caught:', error);
        }
      } }
    );
  });
};

/**
 * Complete flow: Pick and upload profile picture
 */
export const pickAndUploadProfilePicture = async (
  userId: string,
  currentImageUrl?: string
): Promise<ImageUploadResult> => {
  try {
    // Show picker options
    const option = await showImagePickerOptions();
    if (!option) {
      return { success: false, error: 'Cancelled' };
    }

    // Get image URI
    let imageUri: string | null = null;
    if (option === 'camera') {
      imageUri = await takePhotoWithCamera();
    } else {
      imageUri = await pickImageFromLibrary();
    }

    if (!imageUri) {
      return { success: false, error: 'No image selected' };
    }

    // Upload to storage
    const uploadResult = await uploadImageToStorage(imageUri, userId);

    // If upload successful and there's an old image, delete it
    if (uploadResult.success && currentImageUrl) {
      await deleteImageFromStorage(currentImageUrl);
    }

    return uploadResult;
  } catch (error) {
    console.error('Error in pickAndUploadProfilePicture:', error);
    return {
      success: false,
      error: 'Failed to process image. Please try again.',
    };
  }
};
