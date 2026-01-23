import {
    DeleteObjectCommand,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class CloudflareService {
    private readonly logger = new Logger(CloudflareService.name);
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly publicUrl: string;

    constructor(private readonly config: ConfigService) {
        const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
        const accessKeyId = this.config.get<string>('CLOUDFLARE_ACCESS_KEY_ID');
        const secretAccessKey = this.config.get<string>('CLOUDFLARE_SECRET_ACCESS_KEY');
        const endpoint = this.config.get<string>('CLOUDFLARE_ENDPOINT');

        this.bucketName = this.config.get<string>('CLOUDFLARE_BUCKET_NAME')!;
        this.publicUrl = this.config.get<string>('CLOUDFLARE_PUBLIC_URL')!;

        if (!accountId || !accessKeyId || !secretAccessKey || !endpoint || !this.bucketName) {
            throw new Error('Missing Cloudflare R2 configuration. Please check your .env file.');
        }

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        });

        this.logger.log('Cloudflare R2 client initialized successfully');
    }

    /**
     * Compress an image to ensure it's under the target size
     * @param file - The image buffer to compress
     * @param filename - Original filename to determine format
     * @param targetSizeKB - Target size in KB (default: 50KB)
     * @returns Compressed image buffer
     */
    private async compressImage(
        file: Buffer,
        filename: string,
        targetSizeKB: number = 50,
    ): Promise<Buffer> {
        const targetSizeBytes = targetSizeKB * 1024;
        const extension = this.getFileExtension(filename);

        // If file is already under target size, return as-is
        if (file.length <= targetSizeBytes) {
            this.logger.debug(`Image already under ${targetSizeKB}KB, skipping compression`);
            return file;
        }

        this.logger.log(`Compressing image from ${(file.length / 1024).toFixed(2)}KB to under ${targetSizeKB}KB`);

        let quality = 80;
        let compressed = file;
        let attempts = 0;
        const maxAttempts = 10;

        while (compressed.length > targetSizeBytes && attempts < maxAttempts) {
            attempts++;

            try {
                const image = sharp(file);
                const metadata = await image.metadata();

                // Calculate resize dimensions if needed (max 1920px width)
                let resizeWidth: number | undefined;
                if (metadata.width && metadata.width > 1920) {
                    resizeWidth = Math.max(800, 1920 - (attempts * 200));
                }

                // Compress based on format
                if (extension === 'png') {
                    compressed = await image
                        .resize(resizeWidth)
                        .png({
                            quality,
                            compressionLevel: 9,
                            effort: 10,
                        })
                        .toBuffer();
                } else if (extension === 'webp') {
                    compressed = await image
                        .resize(resizeWidth)
                        .webp({ quality })
                        .toBuffer();
                } else {
                    // Default to JPEG for jpg, jpeg, and others
                    compressed = await image
                        .resize(resizeWidth)
                        .jpeg({ quality, mozjpeg: true })
                        .toBuffer();
                }

                this.logger.debug(
                    `Attempt ${attempts}: quality=${quality}, size=${(compressed.length / 1024).toFixed(2)}KB`,
                );

                // Reduce quality for next attempt
                quality = Math.max(20, quality - 10);
            } catch (error) {
                this.logger.error('Image compression failed', error);
                throw new Error('Image compression failed');
            }
        }

        if (compressed.length > targetSizeBytes) {
            this.logger.warn(
                `Could not compress image below ${targetSizeKB}KB after ${maxAttempts} attempts. Final size: ${(compressed.length / 1024).toFixed(2)}KB`,
            );
        } else {
            this.logger.log(
                `Successfully compressed image to ${(compressed.length / 1024).toFixed(2)}KB in ${attempts} attempts`,
            );
        }

        return compressed;
    }

    /**
     * Upload a single file to Cloudflare R2
     * @param file - The file buffer to upload
     * @param filename - Original filename (optional, will generate UUID if not provided)
     * @param folder - Folder path in bucket (e.g., 'orders', 'products')
     * @param compress - Whether to compress the image (default: true)
     * @returns Public URL of the uploaded file
     */
    async uploadFile(
        file: Buffer,
        filename?: string,
        folder: string = 'orders',
        compress: boolean = true,
    ): Promise<string> {
        try {
            const extension = filename ? this.getFileExtension(filename) : 'jpg';

            // Compress image if it's an image file and compression is enabled
            let fileToUpload = file;
            if (compress && this.isImageFile(extension)) {
                fileToUpload = await this.compressImage(file, filename || `image.${extension}`);
            }

            const uniqueFilename = `${folder}/${randomUUID()}.${extension}`;

            const params: PutObjectCommandInput = {
                Bucket: this.bucketName,
                Key: uniqueFilename,
                Body: fileToUpload,
                ContentType: this.getContentType(extension),
            };

            const command = new PutObjectCommand(params);
            await this.s3Client.send(command);

            const publicUrl = `${this.publicUrl}/${uniqueFilename}`;
            this.logger.log(`File uploaded successfully: ${publicUrl}`);

            return publicUrl;
        } catch (error) {
            this.logger.error('Failed to upload file to Cloudflare R2', error);
            throw new Error('File upload failed');
        }
    }

    /**
     * Upload multiple files to Cloudflare R2
     * @param files - Array of file buffers
     * @param filenames - Array of original filenames (optional)
     * @param folder - Folder path in bucket
     * @returns Array of public URLs
     */
    async uploadFiles(
        files: Buffer[],
        filenames?: string[],
        folder: string = 'orders',
    ): Promise<string[]> {
        const uploadPromises = files.map((file, index) => {
            const filename = filenames?.[index];
            return this.uploadFile(file, filename, folder);
        });

        return Promise.all(uploadPromises);
    }

    /**
     * Delete a file from Cloudflare R2
     * @param fileUrl - The public URL of the file to delete
     */
    async deleteFile(fileUrl: string): Promise<void> {
        try {
            const key = this.extractKeyFromUrl(fileUrl);

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            this.logger.log(`File deleted successfully: ${key}`);
        } catch (error) {
            this.logger.error('Failed to delete file from Cloudflare R2', error);
            throw new Error('File deletion failed');
        }
    }

    /**
     * Delete multiple files from Cloudflare R2
     * @param fileUrls - Array of public URLs to delete
     */
    async deleteFiles(fileUrls: string[]): Promise<void> {
        const deletePromises = fileUrls.map((url) => this.deleteFile(url));
        await Promise.all(deletePromises);
    }

    /**
     * Extract the S3 key from a public URL
     */
    private extractKeyFromUrl(url: string): string {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading '/'
    }

    /**
     * Get file extension from filename
     */
    private getFileExtension(filename: string): string {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg';
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(extension: string): string {
        const contentTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            pdf: 'application/pdf',
        };

        return contentTypes[extension] || 'application/octet-stream';
    }

    /**
     * Check if file is an image based on extension
     */
    private isImageFile(extension: string): boolean {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        return imageExtensions.includes(extension.toLowerCase());
    }
}
