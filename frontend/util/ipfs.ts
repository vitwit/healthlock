/**
 * Uploads a JSON object to IPFS via Pinata.
 * @param jsonData - The JSON data to upload
 * @returns The CID (IpfsHash) of the uploaded content
 * @throws Error if the upload fails
 */
export async function uploadJsonToPinata(
    jsonData: any
): Promise<string> {
    const apiKey = 'b7c91487b1dc35474469';
    const apiSecret = 'fc5ad07381525f28d07b4c33f0e556a452b82b764ab9894241df990cda98a8dd';

    try {
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                pinata_api_key: apiKey,
                pinata_secret_api_key: apiSecret,
            },
            body: JSON.stringify(jsonData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pinata upload failed: ${errorText}`);
        }

        const result = await response.json();

        if (!result.IpfsHash) {
            throw new Error('Pinata response missing IpfsHash.');
        }

        console.log('✅ Uploaded to IPFS via Pinata:', result.IpfsHash);
        console.log(`🔗 View: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
        return result.IpfsHash;

    } catch (error: any) {
        const message = error?.message || 'Unknown error occurred during upload to Pinata.';
        console.error('❌ Upload error:', message);
        throw new Error(message);
    }
}
