-- Complete VCSchemaPrice setup with version, updatedAt, composite PK, and trigger

-- Add version column
ALTER TABLE "VCSchemaPrice" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Add updatedAt column  
ALTER TABLE "VCSchemaPrice" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop old primary key and create composite primary key
ALTER TABLE "VCSchemaPrice" DROP CONSTRAINT "VCSchemaPrice_pkey";
ALTER TABLE "VCSchemaPrice" ADD CONSTRAINT "VCSchemaPrice_pkey" PRIMARY KEY ("schemaId", "version");

-- Add index on schemaId
CREATE INDEX "VCSchemaPrice_schemaId_idx" ON "VCSchemaPrice"("schemaId");

-- Add foreign key to VCSchema
ALTER TABLE "VCSchemaPrice" ADD CONSTRAINT "VCSchemaPrice_schemaId_version_fkey" 
  FOREIGN KEY ("schemaId", "version") REFERENCES "VCSchema"("id", "version") 
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default prices for existing VCSchema records
INSERT INTO "VCSchemaPrice" ("schemaId", "version", "price", "currency")
SELECT 
    v.id,
    v.version,
    0 as price,
    'IDR' as currency
FROM "VCSchema" v
WHERE NOT EXISTS (
    SELECT 1 
    FROM "VCSchemaPrice" p 
    WHERE p."schemaId" = v.id 
    AND p."version" = v.version
);

-- Create trigger function
CREATE OR REPLACE FUNCTION create_default_vcschema_price()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "VCSchemaPrice" ("schemaId", "version", "price", "currency")
    VALUES (
        NEW.id,
        NEW.version,
        0,
        'IDR'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_create_vcschema_price
    AFTER INSERT ON "VCSchema"
    FOR EACH ROW
    EXECUTE FUNCTION create_default_vcschema_price();
