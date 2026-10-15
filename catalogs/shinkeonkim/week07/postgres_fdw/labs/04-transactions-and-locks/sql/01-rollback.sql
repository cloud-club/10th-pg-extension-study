BEGIN;
UPDATE writable_school.tx_probe SET value='rolled_back' WHERE id=1;
SELECT value FROM writable_school.tx_probe WHERE id=1;
ROLLBACK;
SELECT value FROM writable_school.tx_probe WHERE id=1;
