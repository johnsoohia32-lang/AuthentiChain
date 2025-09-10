(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PRODUCT-ID u101)
(define-constant ERR-ORACLE-NOT-REGISTERED u109)
(define-constant ERR-INVALID-CONFIDENCE u120)
(define-constant ERR-INVALID-IPFS-HASH u122)
(define-constant ERR-INVALID-BATCH-SIZE u124)
(define-constant ERR-BATCH-ALREADY-PROCESSED u125)
(define-constant ERR-MAX-ORACLES-EXCEEDED u115)
(define-constant ERR-INVALID-SCORE u110)
(define-constant ERR-INVALID-ORACLE-FEE u116)
(define-constant ERR-EXPIRED-VERIFICATION u113)
(define-constant ERR-INVALID-METADATA u114)

(define-data-var next-oracle-id uint u0)
(define-data-var max-oracles uint u50)
(define-data-var verification-fee uint u500)
(define-data-var admin-principal principal tx-sender)

(define-map oracles uint { principal: principal, score: uint, active: bool })
(define-map verification-results uint { product-id: uint, is-authentic: bool, timestamp: uint, oracle-id: uint, confidence: uint })
(define-map product-metadata uint { hash: (buff 32), description: (string-utf8 256), expiry: uint })
(define-map oracle-fees uint uint)
(define-map batch-verifications uint (list 10 uint))

(define-read-only (get-oracle (id uint))
  (map-get? oracles id))

(define-read-only (get-verification-result (id uint))
  (map-get? verification-results id))

(define-read-only (get-product-metadata (product-id uint))
  (map-get? product-metadata product-id))

(define-read-only (get-oracle-fee (oracle-id uint))
  (default-to u0 (map-get? oracle-fees oracle-id)))

(define-read-only (get-batch-verification (batch-id uint))
  (map-get? batch-verifications batch-id))

(define-private (validate-product-id (id uint))
  (if (> id u0) (ok true) (err ERR-INVALID-PRODUCT-ID)))

(define-private (validate-confidence (confidence uint))
  (if (<= confidence u100) (ok true) (err ERR-INVALID-CONFIDENCE)))

(define-private (validate-ipfs-hash (hash (string-ascii 46)))
  (if (is-eq (len hash) u46) (ok true) (err ERR-INVALID-IPFS-HASH)))

(define-private (validate-score (score uint))
  (if (<= score u100) (ok true) (err ERR-INVALID-SCORE)))

(define-private (validate-oracle-fee (fee uint))
  (if (>= fee u0) (ok true) (err ERR-INVALID-ORACLE-FEE)))

(define-private (validate-batch-size (size uint))
  (if (<= size u10) (ok true) (err ERR-INVALID-BATCH-SIZE)))

(define-private (validate-metadata (hash (buff 32)) (desc (string-utf8 256)))
  (if (and (> (len hash) u0) (> (len desc) u0)) (ok true) (err ERR-INVALID-METADATA)))

(define-public (register-oracle (oracle-principal principal) (score uint) (fee uint))
  (let ((next-id (var-get next-oracle-id)))
    (asserts! (< next-id (var-get max-oracles)) (err ERR-MAX-ORACLES-EXCEEDED))
    (asserts! (<= score u100) (err ERR-INVALID-SCORE))
    (asserts! (>= fee u0) (err ERR-INVALID-ORACLE-FEE))
    (map-set oracles next-id { principal: oracle-principal, score: score, active: true })
    (map-set oracle-fees next-id fee)
    (var-set next-oracle-id (+ next-id u1))
    (ok next-id)))

(define-public (submit-verification (product-id uint) (is-authentic bool) (confidence uint) (metadata-hash (buff 32)) (desc (string-utf8 256)) (ipfs-hash (string-ascii 46)))
  (let ((oracle-id (default-to u0 (fold find-oracle-id (keys oracles) u0))) (expiry (+ block-height u144)))
    (asserts! (is-some (map-get? oracles oracle-id)) (err ERR-ORACLE-NOT-REGISTERED))
    (asserts! (> product-id u0) (err ERR-INVALID-PRODUCT-ID))
    (asserts! (<= confidence u100) (err ERR-INVALID-CONFIDENCE))
    (asserts! (and (> (len metadata-hash) u0) (> (len desc) u0)) (err ERR-INVALID-METADATA))
    (asserts! (is-eq (len ipfs-hash) u46) (err ERR-INVALID-IPFS-HASH))
    (try! (stx-transfer? (var-get verification-fee) tx-sender (as-contract tx-sender)))
    (map-set verification-results product-id { product-id: product-id, is-authentic: is-authentic, timestamp: block-height, oracle-id: oracle-id, confidence: confidence })
    (map-set product-metadata product-id { hash: metadata-hash, description: desc, expiry: expiry })
    (ok true)))

(define-public (batch-submit-verifications (product-ids (list 10 uint)) (authentics (list 10 bool)) (confidences (list 10 uint)))
  (let ((batch-id (len (keys batch-verifications))) (size (len product-ids)))
    (asserts! (<= size u10) (err ERR-INVALID-BATCH-SIZE))
    (asserts! (is-none (map-get? batch-verifications batch-id)) (err ERR-BATCH-ALREADY-PROCESSED))
    (map-set batch-verifications batch-id product-ids)
    (fold process-batch-verification (zip product-ids authentics confidences) (ok true))
    (ok batch-id)))

(define-private (find-oracle-id (id uint) (acc uint))
  (if (is-eq (get principal (unwrap-panic (map-get? oracles id))) tx-sender) id acc))

(define-private (process-batch-verification (item {pid: uint, auth: bool, conf: uint}) (res (response bool uint)))
  (match res ok-val (submit-verification (get pid item) (get auth item) (get conf item) (buff 32) "Product" "ipfs-hash-46-chars-long-1234567890123456789012") err-val res))

(define-public (update-oracle-score (oracle-id uint) (new-score uint))
  (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
  (asserts! (<= new-score u100) (err ERR-INVALID-SCORE))
  (match (map-get? oracles oracle-id)
    oracle (begin (map-set oracles oracle-id (merge oracle { score: new-score })) (ok true))
    (err ERR-ORACLE-NOT-REGISTERED)))

(define-public (set-verification-fee (new-fee uint))
  (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
  (asserts! (>= new-fee u0) (err ERR-INVALID-ORACLE-FEE))
  (var-set verification-fee new-fee)
  (ok true))

(define-public (verify-expiry (product-id uint))
  (match (map-get? product-metadata product-id)
    meta (if (> block-height (get expiry meta)) (err ERR-EXPIRED-VERIFICATION) (ok true))
    (err ERR-INVALID-PRODUCT-ID)))