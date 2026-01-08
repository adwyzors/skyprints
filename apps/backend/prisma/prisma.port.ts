export interface PrismaPort {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
