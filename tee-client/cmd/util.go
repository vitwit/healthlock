package cmd

import (
	"fmt"
	"io"
	"net/http"
)

// DownloadJsonFromPinata downloads a JSON object from IPFS using the given CID.
func DownloadJsonFromPinata(cid string) ([]byte, error) {
	url := fmt.Sprintf("https://gateway.pinata.cloud/ipfs/%s", cid)

	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch data from IPFS: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("IPFS gateway returned error: %s", string(body))
	}

	return io.ReadAll(resp.Body)
}
