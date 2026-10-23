-- Human-readable order and booking references (HA-2609-000147 / HB-2609-000092).
--
-- Customers quote these to support and vendors write them on delivery notes, so
-- they must be short, gapless-enough and collision-free. A database sequence is
-- the only way to get that safely under concurrent checkouts; deriving a number
-- from a count() would hand two simultaneous orders the same reference.
--
-- Deliberately separate from the cuid primary key: the PK stays non-enumerable
-- so order ids cannot be guessed from a URL, while the reference stays readable.

CREATE SEQUENCE IF NOT EXISTS homeall_order_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS homeall_booking_seq START WITH 1 INCREMENT BY 1;
