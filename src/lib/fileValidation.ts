// File validation utilities for secure uploads

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxSizeBytes: number;
  allowedTypes: string[];
  allowedExtensions: string[];
}

// Avatar validation: images only, 5MB max
export const AVATAR_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
};

// Resume validation: PDF, DOC, DOCX, 10MB max
export const RESUME_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  allowedExtensions: ['pdf', 'doc', 'docx'],
};

// Company logo validation: images only, 5MB max
export const COMPANY_LOGO_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
};

// Cover image validation: images only, 10MB max
export const COVER_IMAGE_VALIDATION: FileValidationOptions = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
};

/**
 * Validates a file against the specified validation options
 */
export function validateFile(file: File, options: FileValidationOptions): FileValidationResult {
  // Check file type (MIME type)
  if (!options.allowedTypes.includes(file.type)) {
    const friendlyTypes = options.allowedExtensions.map(ext => ext.toUpperCase()).join(', ');
    return {
      valid: false,
      error: `Invalid file type. Please upload a ${friendlyTypes} file.`,
    };
  }

  // Check file size
  if (file.size > options.maxSizeBytes) {
    const maxSizeMB = options.maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`,
    };
  }

  // Check file extension
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension || !options.allowedExtensions.includes(fileExtension)) {
    const friendlyTypes = options.allowedExtensions.map(ext => ext.toUpperCase()).join(', ');
    return {
      valid: false,
      error: `Invalid file extension. Allowed formats: ${friendlyTypes}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates an avatar file
 */
export function validateAvatarFile(file: File): FileValidationResult {
  return validateFile(file, AVATAR_VALIDATION);
}

/**
 * Validates a resume file
 */
export function validateResumeFile(file: File): FileValidationResult {
  return validateFile(file, RESUME_VALIDATION);
}

/**
 * Validates a company logo file
 */
export function validateCompanyLogoFile(file: File): FileValidationResult {
  return validateFile(file, COMPANY_LOGO_VALIDATION);
}

/**
 * Validates a cover image file
 */
export function validateCoverImageFile(file: File): FileValidationResult {
  return validateFile(file, COVER_IMAGE_VALIDATION);
}
