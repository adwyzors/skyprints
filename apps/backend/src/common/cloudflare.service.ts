import {
    DeleteObjectCommand,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

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
     * Upload a single file to Cloudflare R2
     * @param file - The file buffer to upload
     * @param filename - Original filename (optional, will generate UUID if not provided)
     * @param folder - Folder path in bucket (e.g., 'orders', 'products')
     * @returns Public URL of the uploaded file
     */
    async uploadFile(
        file: Buffer,
        filename?: string,
        folder: string = 'orders',
    ): Promise<string> {
        try {
            const extension = filename ? this.getFileExtension(filename) : 'jpg';
            const uniqueFilename = `${folder}/${randomUUID()}.${extension}`;

            const params: PutObjectCommandInput = {
                Bucket: this.bucketName,
                Key: uniqueFilename,
                Body: file,
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
}
