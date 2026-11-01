# MASTER DEVELOPMENT PROMPT: COMPLETE SQL LEARNING MANAGEMENT SYSTEM (24 MODULES)

## With Personal Progress Tracking, Revision Management, Theory, Practice Tests and SQL Lab Integration

## 1. PROJECT OBJECTIVE

I have an existing Data Engineering Practice Platform with the following
features:

-   Dashboard
-   SQL Lab
-   Python Lab
-   PySpark Lab
-   Azure & Databricks
-   ETL Testing
-   Notes & Study Material
-   Question Generation
-   Interview
-   Ask AI
-   Progress & Analytics
-   AI Interview

I want to introduce a complete SQL Learning Management System (SQL
Learning) alongside my existing SQL Lab.

The objective is to build a complete SQL learning platform that takes a
learner from SQL fundamentals to advanced SQL, Data Engineering SQL,
database concepts, data warehousing, query optimization and MNC Data
Engineer / ETL Developer interview readiness.

**IMPORTANT:**

-   Do not replace the existing SQL Lab.
-   Do not break any existing SQL execution functionality.
-   Reuse the existing PostgreSQL execution infrastructure.
-   Reuse existing MongoDB and PostgreSQL integrations wherever
    appropriate.
-   Inspect the existing frontend, backend, database, authentication,
    APIs and SQL execution engine before making modifications.
-   Build SQL Learning as a separate module.
-   Preserve all existing user data and progress.
-   Do not create a static frontend-only demo.
-   Make this a fully functional, database-connected learning management
    system.

------------------------------------------------------------------------

## 2. SIDEBAR NAVIGATION CHANGES

Modify the existing sidebar navigation.

Current navigation:

-   Dashboard
-   SQL Lab
-   Python Lab
-   PySpark Lab
-   Azure & Databricks
-   ETL Testing
-   Notes & Study Material
-   Question Generation
-   Interview
-   Ask AI
-   Progress & Analytics
-   AI Interview

Change it to:

-   Dashboard
-   SQL (Expandable)
    -   SQL Lab (Existing)
    -   SQL Learning (NEW)
-   Python Lab
-   PySpark (Expandable)
    -   PySpark Lab (Existing)
    -   PySpark Learning (Existing / New)
-   Azure & Databricks
-   ETL Testing
-   Notes & Study Material
-   Question Generation
-   Interview
-   Ask AI
-   Progress & Analytics
-   AI Interview

Requirements:

1.  SQL should be an expandable parent menu.
2.  Existing SQL Lab should be placed under SQL.
3.  Add a new SQL Learning submenu.
4.  Preserve existing SQL Lab functionality.
5.  Maintain the existing dark-blue sidebar design.
6.  Maintain responsive desktop and mobile layouts.
7.  Remember the expanded/collapsed state where appropriate.

------------------------------------------------------------------------

## 3. SQL LEARNING DASHBOARD

Build a professional SQL Learning dashboard.

The dashboard must display:

### A. Overall Learning Statistics

-   Total Modules: 24.
-   Total Topics.
-   Total Subtopics.
-   Completed Topics.
-   Remaining Topics.
-   Topics In Progress.
-   Topics Marked for Revision.
-   Topics Mastered.
-   Total Practice Tests.
-   Tests Attempted.
-   Tests Completed.
-   Total Questions.
-   Questions Solved.
-   Correct Answers.
-   Incorrect Answers.
-   Overall Accuracy.
-   Learning Streak.
-   Total Learning Time.
-   Total Revision Sessions.
-   SQL Mastery Score.

### B. Learning Progress

Display:

-   Overall course completion percentage.
-   Module-wise completion.
-   Topic-wise completion.
-   Theory completion.
-   Practical example completion.
-   Practice test completion.
-   Easy / Medium / Hard accuracy.
-   Revision completion.
-   Weak topics.
-   Recently studied topics.
-   Recently revised topics.
-   Upcoming revision topics.
-   Continue Learning button.

### C. Continue Learning

Display:

-   Last studied module.
-   Last studied topic.
-   Last completed section.
-   Last practice test.
-   Last score.
-   Continue button.

The learner should resume from exactly where they stopped.

### D. Module Cards

Every module card should display:

-   Module number.
-   Module title.
-   Description.
-   Total topics.
-   Completed topics.
-   Remaining topics.
-   Revision-required topics.
-   Completion percentage.
-   Difficulty.
-   Module status.

------------------------------------------------------------------------

## 4. COMPLETE SQL CURRICULUM -- 24 MODULES

Implement all 24 modules and all topics below.

Do not create empty modules or placeholder topics.

### MODULE 01 -- SQL Fundamentals

1.  Introduction to SQL.
2.  What is DBMS?
3.  What is RDBMS?
4.  SQL vs MySQL vs PostgreSQL vs SQL Server.
5.  Database Concepts.
6.  Tables, Rows and Columns.
7.  Primary Key.
8.  Foreign Key.
9.  Unique Key.
10. Candidate Key.
11. Composite Key.
12. Super Key.
13. Constraints.
14. NOT NULL.
15. UNIQUE.
16. PRIMARY KEY.
17. FOREIGN KEY.
18. CHECK.
19. DEFAULT.
20. CREATE DATABASE.
21. CREATE TABLE.
22. ALTER TABLE.
23. DROP TABLE.
24. TRUNCATE TABLE.
25. INSERT.
26. UPDATE.
27. DELETE.
28. SELECT.
29. DISTINCT.
30. WHERE.
31. ORDER BY.
32. GROUP BY.
33. HAVING.
34. LIMIT / TOP / FETCH.
35. BETWEEN.
36. IN.
37. NOT IN.
38. LIKE.
39. IS NULL.
40. IS NOT NULL.
41. AND.
42. OR.
43. NOT.
44. Comparison Operators.
45. Arithmetic Operators.
46. Logical Operators.
47. Aliases.
48. SQL Execution Order.

### MODULE 02 -- SQL Data Types & Constraints

1.  Integer.
2.  Smallint.
3.  Bigint.
4.  Decimal.
5.  Numeric.
6.  Float.
7.  Real.
8.  Double Precision.
9.  CHAR.
10. VARCHAR.
11. TEXT.
12. DATE.
13. TIME.
14. TIMESTAMP.
15. TIMESTAMPTZ.
16. BOOLEAN.
17. Binary Data Types.
18. JSON.
19. JSONB.
20. UUID.
21. ENUM.
22. Serial and Identity Columns.
23. NULL Values.
24. Implicit Type Conversion.
25. Explicit Type Conversion.
26. CAST.
27. CONVERT (where supported).
28. Type Compatibility.
29. Choosing Appropriate Data Types.
30. Constraints in Real-World Database Design.

### MODULE 03 -- SQL String Functions

1.  UPPER().
2.  LOWER().
3.  TRIM().
4.  LTRIM().
5.  RTRIM().
6.  BTRIM().
7.  CONCAT().
8.  CONCAT_WS().
9.  SUBSTRING().
10. SUBSTR().
11. LENGTH().
12. CHAR_LENGTH().
13. REPLACE().
14. POSITION().
15. STRPOS().
16. LEFT().
17. RIGHT().
18. REVERSE().
19. REPEAT().
20. LPAD().
21. RPAD().
22. SPLIT_PART().
23. STRING_AGG().
24. INITCAP().
25. ASCII().
26. CHR().
27. REGEXP_REPLACE().
28. REGEXP_MATCHES().
29. REGEXP_SPLIT_TO_ARRAY().
30. Pattern Matching.
31. Wildcards.
32. Regular Expressions.
33. Data Cleaning with String Functions.
34. Email and Phone Number Cleaning.
35. Real-World Text Standardization.

### MODULE 04 -- SQL Numeric & Mathematical Functions

1.  ROUND().
2.  CEIL().
3.  CEILING().
4.  FLOOR().
5.  ABS().
6.  MOD().
7.  POWER().
8.  SQRT().
9.  EXP().
10. LN().
11. LOG().
12. SIGN().
13. TRUNC().
14. RANDOM().
15. PI().
16. GREATEST().
17. LEAST().
18. DIVISION.
19. Percentage Calculation.
20. Decimal Precision.
21. Numeric Type Conversion.
22. Handling Invalid Numeric Values.
23. Financial Calculations.
24. Numeric Data Cleaning.

### MODULE 05 -- SQL Date & Time Functions

1.  CURRENT_DATE.
2.  CURRENT_TIME.
3.  CURRENT_TIMESTAMP.
4.  NOW().
5.  DATE().
6.  EXTRACT().
7.  DATE_PART().
8.  DATE_TRUNC().
9.  AGE().
10. INTERVAL.
11. DATE_ADD concepts.
12. DATE_SUB concepts.
13. DATEDIFF concepts.
14. DATEADD concepts.
15. DATEDIFF vs AGE.
16. DATE_FORMAT concepts.
17. TO_DATE().
18. TO_TIMESTAMP().
19. TO_CHAR().
20. MAKE_DATE().
21. MAKE_TIMESTAMP().
22. LAST_DAY equivalent patterns.
23. First Day of Month.
24. Last Day of Month.
25. Year Extraction.
26. Month Extraction.
27. Day Extraction.
28. Week Extraction.
29. Day of Week.
30. Date Difference.
31. Timestamp Difference.
32. Time Zone Conversion.
33. Date Range Filtering.
34. Rolling Date Filters.
35. Month-wise Aggregation.
36. Year-wise Aggregation.
37. Working with Financial Years.
38. Handling Invalid Dates.
39. Real-World Date Transformation.

**Dialect note:** Teach PostgreSQL syntax as the primary execution
dialect and explain equivalent syntax in SQL Server, MySQL and other
databases where applicable.

### MODULE 06 -- SQL Aggregate Functions & Grouping

1.  COUNT().
2.  COUNT(\*).
3.  COUNT(column).
4.  COUNT(DISTINCT).
5.  SUM().
6.  AVG().
7.  MIN().
8.  MAX().
9.  STRING_AGG().
10. ARRAY_AGG().
11. BOOL_AND().
12. BOOL_OR().
13. STDDEV().
14. VARIANCE().
15. GROUP BY.
16. GROUP BY Multiple Columns.
17. HAVING.
18. Conditional Aggregation.
19. Aggregate with CASE WHEN.
20. FILTER Clause.
21. GROUP BY with NULL.
22. Multiple Aggregations.
23. Aggregation with Joins.
24. Aggregation with Subqueries.
25. ROLLUP.
26. CUBE.
27. GROUPING SETS.
28. GROUPING().
29. Pivoting Concepts.
30. Unpivoting Concepts.
31. Aggregate Performance.
32. Real-World Business Aggregations.

### MODULE 07 -- SQL Joins

1.  Introduction to Joins.
2.  INNER JOIN.
3.  LEFT JOIN.
4.  RIGHT JOIN.
5.  FULL OUTER JOIN.
6.  CROSS JOIN.
7.  SELF JOIN.
8.  NATURAL JOIN.
9.  EQUI JOIN.
10. NON-EQUI JOIN.
11. THETA JOIN.
12. LEFT SEMI JOIN Concepts.
13. LEFT ANTI JOIN Concepts.
14. Multiple Table Joins.
15. Joining Three or More Tables.
16. Join on Multiple Conditions.
17. Join on Different Column Names.
18. Joining Tables with Aliases.
19. Handling Duplicate Columns.
20. Handling NULL Join Keys.
21. Join with Aggregations.
22. Join with Subqueries.
23. Join with CTE.
24. Join with Window Functions.
25. One-to-One Relationships.
26. One-to-Many Relationships.
27. Many-to-Many Relationships.
28. Join Cardinality.
29. Join Performance.
30. Real-World Data Engineering Joins.

### MODULE 08 -- SQL Set Operations

1.  UNION.
2.  UNION ALL.
3.  INTERSECT.
4.  EXCEPT.
5.  MINUS (where supported).
6.  UNION vs UNION ALL.
7.  INTERSECT vs JOIN.
8.  EXCEPT vs NOT EXISTS.
9.  Column Compatibility.
10. Data Type Compatibility.
11. Duplicate Handling.
12. Set Operations with NULL.
13. Multiple Set Operations.
14. Set Operation Execution.
15. Real-World Data Reconciliation.
16. Combining Historical and Current Data.
17. Comparing Source and Target Datasets.

### MODULE 09 -- SQL Subqueries

1.  What is a Subquery?
2.  Single Row Subquery.
3.  Multiple Row Subquery.
4.  Scalar Subquery.
5.  Multi-Column Subquery.
6.  Nested Subqueries.
7.  Correlated Subquery.
8.  Non-Correlated Subquery.
9.  Subquery in SELECT.
10. Subquery in FROM.
11. Subquery in WHERE.
12. Subquery in HAVING.
13. Subquery with JOIN.
14. EXISTS.
15. NOT EXISTS.
16. IN.
17. NOT IN.
18. ANY.
19. ALL.
20. SOME.
21. Subquery vs JOIN.
22. Subquery vs CTE.
23. Correlated Subquery Performance.
24. Real-World Subquery Problems.

### MODULE 10 -- Common Table Expressions (CTE)

1.  What is CTE?
2.  WITH Clause.
3.  Basic CTE.
4.  Multiple CTEs.
5.  CTE with JOIN.
6.  CTE with Aggregation.
7.  CTE with Subquery.
8.  CTE with Window Functions.
9.  Nested CTE Concepts.
10. Recursive CTE.
11. Anchor Member.
12. Recursive Member.
13. UNION ALL in Recursive CTE.
14. Hierarchical Data.
15. Employee Manager Hierarchy.
16. Date Series Generation.
17. CTE vs Subquery.
18. CTE vs Temporary Table.
19. CTE vs Views.
20. CTE Materialization.
21. Materialized CTE Concepts.
22. CTE Optimization.
23. Multiple-Step Data Transformation.
24. Real-World CTE Problems.

### MODULE 11 -- SQL CASE WHEN & Conditional Logic

1.  CASE WHEN.
2.  Simple CASE.
3.  Searched CASE.
4.  Multiple Conditions.
5.  Nested CASE.
6.  CASE with Aggregation.
7.  CASE with GROUP BY.
8.  CASE with ORDER BY.
9.  CASE with JOIN.
10. CASE with Window Functions.
11. COALESCE().
12. NULLIF().
13. GREATEST().
14. LEAST().
15. Conditional COUNT.
16. Conditional SUM.
17. Conditional AVG.
18. Conditional Categorization.
19. Data Classification.
20. Business Rules Implementation.
21. NULL Handling.
22. Real-World Conditional Transformation.

### MODULE 12 -- SQL Window Functions Fundamentals

1.  Introduction to Window Functions.
2.  Window vs Aggregate Functions.
3.  OVER() Clause.
4.  PARTITION BY.
5.  ORDER BY in Window.
6.  ROWS Frame.
7.  RANGE Frame.
8.  Window Frame Boundaries.
9.  UNBOUNDED PRECEDING.
10. CURRENT ROW.
11. UNBOUNDED FOLLOWING.
12. N PRECEDING.
13. N FOLLOWING.
14. ROWS BETWEEN.
15. RANGE BETWEEN.
16. Running Aggregations.
17. Moving Aggregations.
18. Window Functions with Multiple Partitions.
19. Window Functions with NULL.
20. Window Execution Order.
21. Window Function Performance.

### MODULE 13 -- SQL Ranking & Analytical Window Functions

1.  ROW_NUMBER().
2.  RANK().
3.  DENSE_RANK().
4.  NTILE().
5.  PERCENT_RANK().
6.  CUME_DIST().
7.  LAG().
8.  LEAD().
9.  FIRST_VALUE().
10. LAST_VALUE().
11. NTH_VALUE().
12. Running SUM.
13. Running AVG.
14. Running COUNT.
15. Moving Average.
16. Cumulative Maximum.
17. Cumulative Minimum.
18. Top N Records.
19. Top N per Group.
20. Second Highest Salary.
21. Nth Highest Salary.
22. Latest Record per Customer.
23. Previous Transaction.
24. Next Transaction.
25. Consecutive Records.
26. Ranking with Duplicate Values.
27. Window Functions with Multiple Conditions.
28. Real-World Analytical SQL Problems.

### MODULE 14 -- Advanced SQL Query Patterns

1.  Find Duplicate Records.
2.  Remove Duplicate Records.
3.  Find Missing Records.
4.  Find Records Present in One Table but Not Another.
5.  Find Second Highest Salary.
6.  Find Nth Highest Salary.
7.  Find Top N per Department.
8.  Find Latest Record per Customer.
9.  Find First Transaction.
10. Find Last Transaction.
11. Find Consecutive Dates.
12. Find Gaps in Date Sequences.
13. Gaps and Islands Problems.
14. Running Totals.
15. Moving Averages.
16. Cumulative Calculations.
17. Month-over-Month Growth.
18. Year-over-Year Growth.
19. Customer Retention.
20. Customer Churn.
21. Cohort Analysis.
22. Sessionization.
23. Deduplication Using ROW_NUMBER.
24. Conditional Ranking.
25. Pivot and Unpivot.
26. Dynamic Pivot Concepts.
27. Generate Date Series.
28. Find Missing IDs.
29. Find Overlapping Date Ranges.
30. Find Employees with Higher Salary Than Managers.
31. Find Employees Earning More Than Department Average.
32. Find Customers Without Orders.
33. Find Products Never Sold.
34. Find Repeated Transactions.
35. Complex Multi-CTE Problems.

### MODULE 15 -- Advanced SQL Functions & JSON Processing

1.  ARRAY Functions.
2.  ARRAY_AGG().
3.  UNNEST().
4.  ARRAY_LENGTH().
5.  JSON Introduction.
6.  JSON Data Type.
7.  JSONB Data Type.
8.  JSON Operators.
9.  JSON Extraction.
10. JSONB Extraction.
11. JSON_BUILD_OBJECT().
12. JSON_BUILD_ARRAY().
13. JSON_AGG().
14. JSONB_AGG().
15. JSON_OBJECT_AGG().
16. JSONB_OBJECT_AGG().
17. JSON_ARRAY_ELEMENTS().
18. JSONB_ARRAY_ELEMENTS().
19. JSON_TO_RECORD().
20. JSONB_TO_RECORD().
21. JSON Path Basics.
22. XML Functions Overview.
23. Full Text Search Basics.
24. String Aggregation.
25. Advanced Data Extraction.
26. Processing Semi-Structured Data.

### MODULE 16 -- SQL DDL, DML, DCL & TCL

1.  SQL Command Categories.
2.  DDL.
3.  DML.
4.  DQL.
5.  DCL. 
6.  TCL.
7.  CREATE.
8.  ALTER.
9.  DROP.
10. TRUNCATE.
11. INSERT.
12. UPDATE.
13. DELETE.
14. MERGE.
15. GRANT.
16. REVOKE.
17. COMMIT.
18. ROLLBACK.
19. SAVEPOINT.
20. Transaction Management.
21. Auto Commit.
22. Transaction Isolation Basics.
23. DDL vs DML.
24. DELETE vs TRUNCATE vs DROP.
25. MERGE vs UPDATE.
26. Bulk Insert.
27. Upsert.
28. Real-World Database Operations.

### MODULE 17 -- Database Objects & Programming

1.  Tables.
2.  Views.
3.  Materialized Views.
4.  Temporary Tables.
5.  Temporary Views.
6.  Indexes.
7.  Sequences.
8.  Synonyms Overview.
9.  Stored Procedures.
10. User-Defined Functions.
11. Scalar Functions.
12. Table-Valued Functions.
13. Triggers.
14. Cursors.
15. Dynamic SQL.
16. Exception Handling in Procedures.
17. Parameters.
18. Function Return Types.
19. Procedure vs Function.
20. View vs Materialized View.
21. Temporary Table vs CTE.
22. Database Object Management.
23. PostgreSQL PL/pgSQL Fundamentals.
24. Database Programming Best Practices.

### MODULE 18 -- SQL Indexing & Performance Fundamentals

1.  What is an Index?
2.  Why Indexes Are Used.
3.  Clustered Index Concepts.
4.  Non-Clustered Index Concepts.
5.  Primary Key Index.
6.  Unique Index.
7.  Composite Index.
8.  Single Column Index.
9.  B-Tree Index.
10. Hash Index.
11. GIN Index.
12. GiST Index.
13. BRIN Index.
14. Partial Index.
15. Expression Index.
16. Covering Index Concepts.
17. Index Scan.
18. Index Only Scan.
19. Bitmap Index Scan.
20. Sequential Scan.
21. Index Selectivity.
22. Cardinality.
23. Composite Index Column Order.
24. Index Maintenance.
25. When Not to Use Index.
26. Index Performance Testing.

### MODULE 19 -- SQL Query Optimization & Execution Plans

1.  SQL Query Execution Lifecycle.
2.  Logical Query Processing Order.
3.  Physical Query Execution.
4.  Query Optimizer.
5.  Cost-Based Optimization.
6.  EXPLAIN.
7.  EXPLAIN ANALYZE.
8.  Execution Plan.
9.  Sequential Scan.
10. Index Scan.
11. Nested Loop Join.
12. Hash Join.
13. Merge Join.
14. Sort Operations.
15. Aggregation Operations.
16. Join Optimization.
17. Subquery Optimization.
18. CTE Optimization.
19. Predicate Pushdown.
20. Projection Pruning Concepts.
21. Avoid SELECT \*.
22. Index Selection.
23. Filter Optimization.
24. Query Rewriting.
25. Avoiding Unnecessary DISTINCT.
26. Optimizing GROUP BY.
27. Optimizing Window Functions.
28. Handling Large Tables.
29. Query Performance Comparison.
30. Real-World Slow Query Debugging.

### MODULE 20 -- Database Design & Normalization

1.  Database Design Fundamentals.
2.  ER Diagrams.
3.  Entities.
4.  Attributes.
5.  Relationships.
6.  One-to-One.
7.  One-to-Many.
8.  Many-to-Many.
9.  Functional Dependencies.
10. Database Normalization.
11. First Normal Form.
12. Second Normal Form.
13. Third Normal Form.
14. BCNF.
15. Fourth Normal Form Overview.
16. Denormalization.
17. Surrogate Keys.
18. Natural Keys.
19. Composite Keys.
20. Referential Integrity.
21. Database Constraints.
22. OLTP Database Design.
23. Schema Design.
24. Star Schema Basics.
25. Snowflake Schema Basics.
26. Data Modeling Best Practices.

### MODULE 21 -- SQL Transactions, Concurrency & Reliability

1.  What is a Transaction?
2.  ACID Properties.
3.  Atomicity.
4.  Consistency.
5.  Isolation.
6.  Durability.
7.  Transaction Lifecycle.
8.  COMMIT.
9.  ROLLBACK.
10. SAVEPOINT.
11. Transaction Isolation Levels.
12. Read Uncommitted.
13. Read Committed.
14. Repeatable Read.
15. Serializable.
16. Dirty Reads.
17. Non-Repeatable Reads.
18. Phantom Reads.
19. Lost Updates.
20. Deadlocks.
21. Locking.
22. Shared Locks.
23. Exclusive Locks.
24. Row-Level Locking.
25. Table-Level Locking.
26. MVCC.
27. Optimistic Concurrency.
28. Pessimistic Concurrency.
29. Transaction Error Handling.
30. Database Reliability.

### MODULE 22 -- Data Warehousing & Data Engineering SQL

1.  What is Data Warehousing?
2.  OLTP vs OLAP.
3.  Data Warehouse Architecture.
4.  Data Lake.
5.  Data Lakehouse.
6.  ETL vs ELT.
7.  Fact Tables.
8.  Dimension Tables.
9.  Star Schema.
10. Snowflake Schema.
11. Fact Table Types.
12. Transaction Fact Table.
13. Snapshot Fact Table.
14. Accumulating Snapshot.
15. Dimension Types.
16. SCD Type 0.
17. SCD Type 1.
18. SCD Type 2.
19. SCD Type 3.
20. Surrogate Key.
21. Natural Key.
22. Business Key.
23. Effective Start Date.
24. Effective End Date.
25. Current Record Flag.
26. Incremental Load.
27. Full Load.
28. Watermark-Based Load.
29. CDC Fundamentals.
30. MERGE-Based Upsert.
31. Deduplication.
32. Source-to-Target Validation.
33. Data Reconciliation.
34. Data Quality Checks.
35. Audit Columns.
36. Late Arriving Dimensions.
37. Late Arriving Facts.
38. Handling Missing Data.
39. Idempotent ETL Operations.
40. SQL-Based ETL Pipeline Design.

### MODULE 23 -- Advanced SQL for Data Engineering & Production

1.  Incremental Data Processing.
2.  Change Data Capture.
3.  CDC-Based SQL Processing.
4.  Watermark Logic.
5.  Batch Processing.
6.  Data Reconciliation.
7.  Source vs Target Comparison.
8.  Duplicate Detection.
9.  Data Quality Framework.
10. Null Validation.
11. Schema Validation.
12. Referential Integrity Validation.
13. Data Completeness Checks.
14. Data Accuracy Checks.
15. Data Freshness Checks.
16. Audit Logging.
17. Error Logging.
18. Retry Logic.
19. Idempotency.
20. Upsert Patterns.
21. MERGE Operations.
22. SCD Type 1 Implementation.
23. SCD Type 2 Implementation.
24. Incremental Aggregation.
25. Partition-Based Data Processing.
26. Date-Based Data Loads.
27. Large Dataset Handling.
28. Data Archiving.
29. Historical Data Management.
30. Production SQL Troubleshooting.
31. SQL for Batch ETL.
32. SQL for Analytical Pipelines.
33. SQL Pipeline Testing.
34. Real-World Production Scenarios.

### MODULE 24 -- SQL Interview Preparation & Advanced Problem Solving

1.  SQL Fundamentals Interview Questions.
2.  SQL Joins Interview Questions.
3.  SQL Subquery Interview Questions.
4.  CTE Interview Questions.
5.  Window Function Interview Questions.
6.  Ranking Interview Questions.
7.  String Function Interview Questions.
8.  Date Function Interview Questions.
9.  Aggregate Function Interview Questions.
10. Advanced Query Pattern Questions.
11. Query Optimization Interview Questions.
12. Indexing Interview Questions.
13. Database Design Questions.
14. Normalization Questions.
15. Transaction Questions.
16. ACID Interview Questions.
17. OLTP vs OLAP.
18. Data Warehouse Questions.
19. Star Schema vs Snowflake Schema.
20. SCD Type 1 vs Type 2.
21. Incremental Load Scenarios.
22. CDC Scenarios.
23. Source-to-Target Validation.
24. Data Deduplication Scenarios.
25. Real-World ETL SQL Scenarios.
26. MNC Service-Based Company Interview Questions.
27. Accenture-Style SQL Problems.
28. Cognizant-Style SQL Problems.
29. Capgemini-Style SQL Problems.
30. LTIMindtree-Style SQL Problems.
31. SQL Coding Challenges.
32. Easy SQL Problems.
33. Medium SQL Problems.
34. Hard SQL Problems.
35. Complete SQL Mock Interview.

**Curriculum implementation note:** All 24 modules must be available and
editable. Use PostgreSQL as the primary executable SQL dialect because
the existing SQL Lab uses PostgreSQL. Explain differences in SQL Server,
MySQL, Oracle and other dialects wherever applicable.

------------------------------------------------------------------------

## 5. INDIVIDUAL TOPIC LEARNING PAGE

Every topic must have its own dedicated learning page.

Example:

SQL Learning → Module 03: SQL String Functions → Topic: TRIM()

Every topic page should contain the following sections.

### A. Topic Overview

-   Topic name.
-   Module name.
-   Description.
-   Difficulty.
-   Estimated learning time.
-   Learning objectives.
-   Previous topic.
-   Next topic.
-   Related topics.
-   Prerequisites.

### B. Detailed Theory

Provide comprehensive explanations:

1.  What is this concept?
2.  Why is it required?
3.  How does it work?
4.  Syntax.
5.  Parameters.
6.  Return type.
7.  Different variations.
8.  Important rules.
9.  Common mistakes.
10. Real-world Data Engineering use cases.
11. Interview relevance.
12. PostgreSQL-specific behavior.
13. Differences across SQL dialects where applicable.

Theory should be detailed enough for a beginner to understand without
depending on external resources.

### C. Practical Examples

Minimum 5 worked examples for every topic.

1.  Basic example.
2.  Intermediate example.
3.  Advanced example.
4.  Real-world Data Engineering example.
5.  Interview-oriented example.

Every example must include:

-   Problem statement.
-   Input dataset.
-   SQL query.
-   Expected output.
-   Step-by-step explanation.
-   Important observations.
-   Execution compatibility.

Allow learners to copy and execute examples directly in the existing SQL
Lab.

### D. Important Notes

Include:

-   Interview questions.
-   Common errors.
-   Performance considerations.
-   Related SQL concepts.
-   Real-world use cases.
-   Database compatibility notes.

### E. Topic Actions

Provide:

-   Mark as Studied.
-   Mark Theory as Completed.
-   Mark Examples as Completed.
-   Mark Practice as Completed.
-   Mark as Mastered.
-   Mark for Revision.
-   Bookmark.
-   Personal Notes.
-   Ask AI.
-   Run SQL Example.
-   Next Topic.

Opening a topic must NOT automatically mark it as completed.

------------------------------------------------------------------------

## 6. PERSONAL LEARNING CHECKLIST -- MANDATORY FEATURE

This is one of the most important features.

I want a checkbox-based personal learning tracker for every individual
SQL topic.

The system should remember what I have already studied, so I do not have
to study the same topic again unnecessarily.

### A. Topic-Level Checklist

For every topic, show the following checkboxes:

-   [ ] Theory Read.
-   [ ] Theory Understood.
-   [ ] Basic Examples Completed.
-   [ ] Intermediate Examples Completed.
-   [ ] Advanced Examples Completed.
-   [ ] Real-World Examples Completed.
-   [ ] Interview Examples Completed.
-   [ ] Practice Test 1 Completed.
-   [ ] Practice Test 2 Completed.
-   [ ] Practice Test 3 Completed.
-   [ ] Practice Test 4 Completed.
-   [ ] Practice Test 5 Completed.
-   [ ] Module Assessment Completed.
-   [ ] Topic Revision Completed.
-   [ ] Topic Mastered.

These checkboxes must be interactive and connected to the backend.

### B. Automatic and Manual Completion

Support both:

1.  Automatic progress tracking.
2.  Manual checkbox tracking.

Examples:

-   When theory is read, the learner can manually mark it as completed.
-   When a practice test is submitted, automatically update its
    completion checkbox.
-   When examples are executed or marked complete, update example
    progress.
-   When all required learning activities are completed, update topic
    completion.
-   Allow manual corrections if a learner has already studied something
    outside the platform.

Do not automatically mark theory as completed just because the learner
opened it.

### C. Individual Section Completion

Show separate completion percentages:

-   Theory: 100%.
-   Examples: 60%.
-   Practice Tests: 40%.
-   Revision: 0%.
-   Overall Topic Completion: 50%.

Calculate these percentages from actual checklist and test data.

### D. Previously Studied Topic Recognition

When a learner returns to a module:

-   Previously completed topics must remain marked as completed.
-   Previously completed tests must retain their scores.
-   Completed theory must not reset.
-   Completed examples must not reset.
-   Revision history must remain available.
-   Show a "Previously Studied" indicator.
-   Show the last studied date.
-   Show the last completed activity.

Provide a filter:

-   All Topics.
-   Not Started.
-   In Progress.
-   Studied.
-   Practice Pending.
-   Completed.
-   Mastered.
-   Revision Required.

Add a "Hide Completed Topics" option.

------------------------------------------------------------------------

## 7. TOPIC STATUS, COLORS & VISUAL INDICATORS

Create a consistent visual status system.

Suggested statuses:

1.  Not Started -- Grey.
2.  Learning in Progress -- Blue.
3.  Theory Completed -- Light Blue.
4.  Practice Pending -- Orange.
5.  Completed -- Green.
6.  Revision Required -- Red.
7.  Revision in Progress -- Purple.
8.  Mastered -- Dark Green.

Display the appropriate status color on:

-   Module cards.
-   Topic cards.
-   Topic detail pages.
-   Learning checklist.
-   Dashboard.
-   Revision Center.
-   Progress Analytics.

Use small status badges, icons and checkmarks.

Do not make the entire interface unnecessarily colorful.

The learner should immediately identify which topics are complete,
pending or need revision.

------------------------------------------------------------------------

## 8. TOPIC-WISE PRACTICE TEST SYSTEM

This is mandatory.

For EVERY individual topic in all 24 modules:

-   Minimum 5 separate practice tests.
-   Each practice test must contain at least 15 questions.
-   Minimum 75 questions per topic.
-   Avoid unnecessary question repetition.

Example:

Module 03 -- SQL String Functions

TRIM():

-   Test 1: 15 questions.
-   Test 2: 15 questions.
-   Test 3: 15 questions.
-   Test 4: 15 questions.
-   Test 5: 15 questions.

CONCAT():

-   Test 1: 15 questions.
-   Test 2: 15 questions.
-   Test 3: 15 questions.
-   Test 4: 15 questions.
-   Test 5: 15 questions.

Follow the same requirements for every topic in every module.

### A. Difficulty Distribution

Each 15-question test should contain:

-   5 Easy questions.
-   5 Medium questions.
-   5 Hard questions.

### B. Question Types

Support:

1.  Write SQL Query.
2.  Multiple Choice Questions.
3.  Predict the Output.
4.  Debug the Query.
5.  Complete Missing SQL.
6.  Identify the Error.
7.  Real-World Scenario.
8.  Data Transformation Problem.
9.  Query Optimization Problem.
10. Interview-Based Question.

### C. Practice Test Interface

Display:

-   Question number.
-   Question statement.
-   Difficulty.
-   Input tables.
-   Table schemas.
-   Sample records.
-   Expected output where appropriate.
-   SQL code editor.
-   Run Query.
-   Submit Answer.
-   Reset.
-   Hint.
-   Show Explanation.
-   Previous Question.
-   Next Question.
-   Test Progress.

### D. Result Page

After each test, display:

-   Total Questions.
-   Correct Answers.
-   Incorrect Answers.
-   Skipped Questions.
-   Score.
-   Accuracy.
-   Time Taken.
-   Difficulty-wise Performance.
-   Correct SQL Query.
-   Detailed Explanation.
-   Questions Requiring Revision.

Allow users to retake tests.

Preserve previous attempts rather than overwriting them.

------------------------------------------------------------------------

## 9. REVISION MANAGEMENT SYSTEM -- VERY IMPORTANT

Build a dedicated Revision Management System.

I want to revise topics multiple times and track exactly how many times
I have revised each topic.

### A. Mark for Revision

Every topic should have a "Mark for Revision" button.

When clicked:

-   Change topic status to Revision Required.
-   Show a red or appropriate revision indicator.
-   Add the topic to Revision Center.
-   Allow the learner to select revision priority.
-   Allow a reason for revision.

Revision reasons:

-   Theory Not Clear.
-   Forgot the Concept.
-   Practice Test Score Low.
-   Coding Mistakes.
-   Interview Preparation.
-   Manual Revision Request.

### B. Revision Priority

Support:

-   High Priority.
-   Medium Priority.
-   Low Priority.

### C. Revision History

For every topic, store:

-   Total Revision Count.
-   First Revision Date.
-   Last Revision Date.
-   Previous Revision Date.
-   Revision Session Number.
-   Score Before Revision.
-   Score After Revision.
-   Accuracy Improvement.
-   Revision Notes.
-   Revision Duration.
-   Revision Status.

Example:

**Topic: ROW_NUMBER()**

``` text
Initial Learning: 01 November 2026

Revision History:
Revision 1: 03 November 2026
Revision 2: 07 November 2026
Revision 3: 15 November 2026
Revision 4: 25 November 2026

Total Revisions: 4

Last Revision Score: 92%
Previous Score: 68%

Status: Mastered
```

These values must come from actual user activity, not hardcoded
examples.

### D. Revision Workflow

When a learner clicks "Start Revision":

1.  Open the topic's theory summary.
2.  Show important notes.
3.  Show previously incorrect questions.
4.  Show bookmarked questions.
5.  Show practical examples.
6.  Start a revision practice test.
7.  Record the revision session.
8.  Calculate the new score.
9.  Update the revision count.
10. Update the next revision recommendation.

Do not increase the revision count just because a learner opens a topic.
Count an actual completed revision session.

### E. Revision Center Dashboard

Display:

-   Total Topics for Revision.
-   High Priority Topics.
-   Medium Priority Topics.
-   Low Priority Topics.
-   Revision Sessions Completed.
-   Topics Successfully Mastered.
-   Topics Still Weak.
-   Topics Due for Revision.
-   Recently Revised Topics.

Provide filters:

-   All Revisions.
-   Pending.
-   In Progress.
-   Completed.
-   High Priority.
-   Medium Priority.
-   Low Priority.
-   Weak Topics.
-   Mastered Topics.

### F. Revision Scheduling

Provide configurable revision reminders.

Suggested intervals:

-   First Revision: 1 day after learning.
-   Second Revision: 3 days later.
-   Third Revision: 7 days later.
-   Fourth Revision: 14 days later.
-   Fifth Revision: 30 days later.

Allow the learner to modify these intervals.

Do not force revisions on every learner.

Use accuracy and learner performance to recommend revision dates.

### G. Revision Analytics

Create:

-   Topic-wise revision count.
-   Weekly revision activity.
-   Monthly revision activity.
-   Score improvement after revisions.
-   Revision success rate.
-   Topics requiring repeated revisions.

------------------------------------------------------------------------

## 10. MODULE-LEVEL ASSESSMENTS

Apart from individual topic tests, create separate module-level
assessments.

For every module:

-   One Module Revision Test.
-   Minimum 30 questions.
-   Easy, Medium and Hard questions.
-   Questions from all topics in the module.
-   Randomized question order.
-   Detailed result analysis.

Create additional assessments:

1.  SQL Fundamentals Assessment.
2.  SQL Functions Assessment.
3.  SQL Joins Assessment.
4.  SQL Subqueries Assessment.
5.  CTE Assessment.
6.  Window Functions Assessment.
7.  Advanced SQL Assessment.
8.  SQL Query Pattern Assessment.
9.  SQL Performance Assessment.
10. Database Concepts Assessment.
11. Data Warehousing Assessment.
12. Data Engineering SQL Assessment.
13. Complete SQL Mock Interview.

Module assessment completion must be tracked separately from topic-level
tests.

------------------------------------------------------------------------

## 11. EXISTING SQL LAB INTEGRATION

Integrate SQL Learning with the existing SQL Lab.

Do not build an entirely separate SQL execution engine.

Requirements:

-   Every practical example should have a Run in SQL Lab option.
-   Every coding question should support SQL execution.
-   Allow loading the question's sample tables.
-   Show table schema.
-   Show sample records.
-   Show expected output where appropriate.
-   Execute the learner's query.
-   Display actual output.
-   Validate results against test cases.
-   Display syntax errors.
-   Support multiple queries where appropriate.
-   Allow learners to open a problem directly in SQL Lab.

The existing PostgreSQL execution engine should be reused.

Preserve existing SQL Lab features, user history and execution
functionality.

------------------------------------------------------------------------

## 12. SQL EDITOR AND PRACTICE EXPERIENCE

Provide a professional SQL editor.

Requirements:

-   Syntax highlighting.
-   SQL autocomplete where supported.
-   Code formatting.
-   Run Query.
-   Submit Answer.
-   Reset Query.
-   Clear Output.
-   Execution Time.
-   Result Table.
-   Error Display.
-   Query History.
-   Save Query.
-   Bookmark Query.
-   Copy Query.
-   Show Solution.

For SQL Learning, automatically load the relevant sample schema and
dataset.

------------------------------------------------------------------------

## 13. AI-POWERED SQL LEARNING ASSISTANT

Integrate the existing Ask AI feature.

The AI assistant must know:

-   Current module.
-   Current topic.
-   Current question.
-   Current database schema.
-   Sample records.
-   Expected output.
-   Learner's SQL query.
-   Execution result.
-   SQL error.
-   Previous attempts.
-   Previous mistakes.

AI capabilities:

1.  Explain SQL concepts.
2.  Explain queries line by line.
3.  Generate examples.
4.  Debug SQL queries.
5.  Explain SQL errors.
6.  Suggest query improvements.
7.  Explain execution plans.
8.  Compare different SQL approaches.
9.  Generate practice questions.
10. Provide hints without immediately revealing the answer.
11. Explain interview scenarios.
12. Identify weak topics.
13. Recommend revision.
14. Generate personalized practice tests.
15. Explain PostgreSQL vs SQL Server syntax.
16. Recommend the next topic based on learning progress.

------------------------------------------------------------------------

## 14. PERSONAL NOTES & BOOKMARKS

For every topic, allow:

-   Add Personal Notes.
-   Edit Notes.
-   Delete Notes.
-   Bookmark Topic.
-   Bookmark Question.
-   Bookmark SQL Query.
-   Save Important Examples.
-   Mark Important Concepts.

Allow learners to maintain their own notes independently of the official
theory.

Save all notes to the user's account.

------------------------------------------------------------------------

## 15. PROGRESS & ANALYTICS INTEGRATION

Integrate SQL Learning into the existing Progress & Analytics system.

Track SQL Learning separately from Python and PySpark.

Metrics:

-   Total Modules.
-   Total Topics.
-   Completed Topics.
-   Remaining Topics.
-   Topics Studied.
-   Topics in Progress.
-   Topics Mastered.
-   Theory Completion.
-   Example Completion.
-   Practice Completion.
-   Revision Completion.
-   Total Questions Solved.
-   Correct Answers.
-   Incorrect Answers.
-   Overall Accuracy.
-   Easy / Medium / Hard Accuracy.
-   Total Revision Count.
-   Topic-wise Revision Count.
-   Score Improvement.
-   Daily Learning Activity.
-   Monthly Learning Progress.
-   Learning Streak.
-   Total Learning Time.

Create charts:

1.  Daily SQL Practice.
2.  Module Completion.
3.  Topic Completion.
4.  Difficulty-wise Accuracy.
5.  Monthly Learning Progress.
6.  Topic Mastery Distribution.
7.  Revision Activity.
8.  Revision Score Improvement.
9.  Weak Topic Distribution.
10. Practice Test Performance.

------------------------------------------------------------------------

## 16. USER-EDITABLE CURRICULUM MANAGEMENT -- MANDATORY

This is an important additional feature.

The learner must have the ability to customize their own learning
curriculum.

Do not hardcode the curriculum in frontend components.

### A. Editable Module Names

Allow the user to:

-   Edit module names.
-   Edit module descriptions.
-   Change module order.
-   Add new modules.
-   Delete modules.
-   Duplicate modules.
-   Change module difficulty.
-   Archive modules.
-   Restore archived modules.

### B. Editable Topic Names

Allow the user to:

-   Edit topic names.
-   Edit topic descriptions.
-   Change topic order.
-   Add new topics.
-   Delete topics.
-   Duplicate topics.
-   Move topics between modules.
-   Change topic difficulty.
-   Add prerequisites.
-   Add estimated learning time.

### C. Editable Learning Content

Allow the user to:

-   Edit theory.
-   Add theory sections.
-   Delete theory sections.
-   Edit SQL syntax.
-   Add examples.
-   Edit examples.
-   Delete examples.
-   Add sample datasets.
-   Edit sample datasets.
-   Add interview questions.
-   Add important notes.
-   Add external learning resources.

### D. Editable Practice Tests

Allow the user to:

-   Create a new practice test.
-   Edit test names.
-   Add questions.
-   Edit questions.
-   Delete questions.
-   Change difficulty.
-   Change question type.
-   Edit correct answers.
-   Edit explanations.
-   Add test cases.
-   Duplicate tests.
-   Reorder questions.

### E. User-Specific Curriculum

Important:

Maintain the official default SQL curriculum while allowing each user to
create a personalized version.

Provide two modes:

1.  Default Curriculum.
2.  My Custom Curriculum.

Allow the learner to customize their own curriculum without changing the
default curriculum for other users.

If the user edits an official module or topic, provide an option to:

-   Edit My Copy.
-   Create a Personal Copy.
-   Restore Original Content.

### F. Safe Editing

Before deleting a module or topic:

-   Show confirmation.
-   Explain what content will be affected.
-   Preserve historical test attempts.
-   Preserve revision history.
-   Do not silently delete user progress.
-   Provide archive instead of permanent deletion where possible.

If a topic is renamed, maintain its existing progress using a stable
topic ID.

Do not use the topic name itself as the database primary key.

------------------------------------------------------------------------

## 17. PERSONAL LEARNING PLAN

Provide a personal learning planner.

Allow learners to:

-   Set a target completion date.
-   Set daily study time.
-   Select topics to study.
-   Set weekly learning goals.
-   Set revision goals.
-   Track daily completion.

Display:

-   Today's Learning Goal.
-   Today's Completed Topics.
-   Pending Topics.
-   Upcoming Revisions.
-   Weekly Progress.
-   Monthly Progress.

Allow the learner to pause or modify their plan.

------------------------------------------------------------------------

## 18. SQL CONTENT GENERATION ARCHITECTURE

Because the curriculum contains many topics and potentially thousands of
questions, use a scalable content-generation architecture.

Do not generate all content in one AI request.

Requirements:

1.  Preload all 24 modules.
2.  Preload all topic metadata.
3.  Generate theory topic by topic.
4.  Generate practical examples in batches.
5.  Generate 5 tests per topic.
6.  Generate at least 15 questions per test.
7.  Validate every SQL query.
8.  Execute code against sample datasets.
9.  Validate expected output.
10. Store approved content permanently.
11. Avoid duplicate questions.
12. Regenerate invalid questions.
13. Allow retry after generation failures.
14. Show content-generation status.

Every published topic must have:

-   Complete theory.
-   Minimum 5 worked examples.
-   Minimum 5 practice tests.
-   Minimum 15 valid questions per test.

Never show an incomplete test as a fully published test.

Use PostgreSQL as the default SQL validation environment.

------------------------------------------------------------------------

## 19. DATABASE ARCHITECTURE

Inspect existing MongoDB and PostgreSQL architecture before
implementation.

Suggested logical collections/tables:

-   sql_modules
-   sql_topics
-   sql_topic_theory
-   sql_topic_sections
-   sql_examples
-   sql_practice_tests
-   sql_questions
-   sql_test_attempts
-   sql_code_submissions
-   sql_topic_progress
-   sql_module_progress
-   sql_learning_checklists
-   sql_revision_items
-   sql_revision_history
-   sql_bookmarks
-   sql_personal_notes
-   sql_learning_activity
-   sql_user_curriculum
-   sql_custom_modules
-   sql_custom_topics
-   sql_custom_examples
-   sql_custom_tests

### Required Tracking Fields

Track:

-   user_id
-   module_id
-   topic_id
-   test_id
-   question_id
-   attempt_id
-   score
-   accuracy
-   completion_status
-   theory_completed
-   examples_completed
-   practice_completed
-   revision_completed
-   mastery_status
-   attempts_count
-   revision_count
-   revision_priority
-   revision_reason
-   last_studied_at
-   first_completed_at
-   last_revision_at
-   next_revision_at
-   time_spent
-   created_at
-   updated_at

Maintain stable IDs even when module names or topic names are edited.

### Data Integrity Requirements

-   Separate common curriculum content from user-specific progress.
-   Preserve test attempts.
-   Preserve revision history.
-   Preserve bookmarks.
-   Preserve personal notes.
-   Prevent duplicate progress records.
-   Use appropriate database indexes.
-   Support migrations without losing existing user data.
-   Ensure one user's custom curriculum does not affect another user's
    curriculum.

------------------------------------------------------------------------

## 20. ADMIN MANAGEMENT

Create an Admin interface for SQL curriculum management.

Admin should be able to:

-   View all 24 modules.
-   View all topics.
-   Edit official module content.
-   Add topics.
-   Delete topics.
-   Reorder topics.
-   Edit theory.
-   Add examples.
-   Generate practice tests.
-   Edit questions.
-   Validate SQL queries.
-   Run sample solutions.
-   Verify expected outputs.
-   Publish/unpublish topics.
-   Review failed question generation.
-   View topic-wise test counts.
-   View question counts.
-   Identify incomplete content.
-   View user progress.
-   Review content quality.

Provide a validation indicator for each topic:

-   Theory Available.
-   5 Examples Available.
-   5 Tests Available.
-   15 Questions per Test.
-   SQL Queries Validated.
-   Expected Output Validated.
-   Published.

Separate Admin permissions from normal learner permissions.

------------------------------------------------------------------------

## 21. UI/UX DESIGN REQUIREMENTS

Follow the existing Data Engineering Practice Platform theme.

Use:

-   Existing dark-blue sidebar.
-   Existing typography.
-   Existing cards.
-   Existing colors.
-   Existing border radius.
-   Existing responsive layout.

Suggested SQL Learning structure:

1.  SQL Learning Dashboard.
2.  Curriculum / Module List.
3.  Module Detail Page.
4.  Topic Detail Page.
5.  Theory.
6.  Practical Examples.
7.  Practice Tests.
8.  Assessment Results.
9.  Personal Learning Checklist.
10. Revision Center.
11. Personal Notes.
12. Learning Planner.
13. SQL Analytics.
14. Curriculum Editor.

Provide:

-   Module search.
-   Topic search.
-   Difficulty filter.
-   Completion filter.
-   Revision filter.
-   Bookmarks.
-   Previously Studied filter.
-   Hide Completed Topics.
-   Sort by module.
-   Sort by completion.
-   Sort by revision priority.

Keep the interface professional and easy to navigate.

------------------------------------------------------------------------

## 22. PERFORMANCE, SECURITY AND RELIABILITY

-   Do not load every module and question at once.
-   Use pagination and lazy loading.
-   Cache curriculum content.
-   Avoid unnecessary AI API calls.
-   Save progress reliably.
-   Prevent duplicate submissions.
-   Apply SQL execution timeouts.
-   Restrict expensive or unsafe SQL operations in practice
    environments.
-   Isolate user execution sessions.
-   Secure SQL runner authentication.
-   Do not expose execution tokens or API keys.
-   Handle database connection failures.
-   Support session reset.
-   Maintain existing authentication.
-   Preserve existing user progress.
-   Do not break existing SQL, Python or PySpark Labs.
-   Maintain database migration safety.
-   Add proper error handling.
-   Maintain reliable revision history.
-   Ensure custom curriculum edits do not corrupt the default
    curriculum.

------------------------------------------------------------------------

## 23. DEVELOPMENT PHASES

Implement in the following order.

### PHASE 1 -- Architecture and Navigation

-   Inspect existing project.
-   Add SQL parent navigation.
-   Move existing SQL Lab under SQL.
-   Add SQL Learning.
-   Add all 24 modules and topic metadata.
-   Create database structure.
-   Implement user-specific progress storage.

### PHASE 2 -- Learning Content

-   Module pages.
-   Topic pages.
-   Detailed theory.
-   Code examples.
-   Expected outputs.
-   PostgreSQL compatibility labels.

### PHASE 3 -- SQL Execution Experience

-   SQL editor.
-   Run query.
-   Sample dataset loading.
-   Result display.
-   Error display.
-   Test case validation.
-   SQL Lab integration.

### PHASE 4 -- Practice Tests

-   Five tests per topic.
-   At least 15 questions per test.
-   Code editor integration.
-   Automated execution.
-   Test case validation.
-   Hints and solutions.

### PHASE 5 -- Personal Learning Checklist

-   Theory checkboxes.
-   Example checkboxes.
-   Practice test checkboxes.
-   Automatic progress updates.
-   Manual completion.
-   Previously studied tracking.
-   Completion filters.
-   Hide completed topics.

### PHASE 6 -- Revision Management

-   Mark for revision.
-   Revision priority.
-   Revision center.
-   Revision history.
-   Revision count.
-   Revision scheduling.
-   Score improvement.
-   Revision analytics.

### PHASE 7 -- Custom Curriculum Editor

-   Editable module names.
-   Editable topic names.
-   Add/delete modules.
-   Add/delete topics.
-   Editable theory.
-   Editable examples.
-   Editable practice tests.
-   Personal curriculum.
-   Restore original content.

### PHASE 8 -- Assessments and AI

-   Module assessments.
-   Full SQL mock interview.
-   AI explanations.
-   Query debugging.
-   AI question generation.
-   Personalized revision recommendations.

### PHASE 9 -- Progress and Analytics

-   Topic completion.
-   Module completion.
-   Accuracy tracking.
-   Revision tracking.
-   Learning streak.
-   Learning planner.
-   Analytics.

### PHASE 10 -- Admin and Testing

-   Curriculum management.
-   Question validation.
-   SQL query validation.
-   Execution testing.
-   Security testing.
-   Regression testing.

------------------------------------------------------------------------

## 24. FINAL ACCEPTANCE CRITERIA

The implementation is complete only when:

1.  SQL parent navigation works.
2.  Existing SQL Lab works.
3.  SQL Learning opens correctly.
4.  All 24 modules exist.
5.  Every listed topic exists.
6.  Every topic has complete theory.
7.  Every topic has at least 5 practical examples.
8.  Every topic has at least 5 practice tests.
9.  Every test has at least 15 valid questions.
10. SQL coding questions execute correctly.
11. Expected output validation works.
12. Test results and explanations work.
13. Progress saves correctly.
14. Individual learning checkboxes work.
15. Previously studied topics remain marked.
16. Completed topics are not reset.
17. Hide Completed Topics works.
18. Revision status and color indicators work.
19. Revision count is accurate.
20. Revision history is preserved.
21. Revision scheduling works.
22. Score improvement after revision is tracked.
23. AI assistance works.
24. Module assessments work.
25. Custom curriculum editing works.
26. Topic names are editable.
27. Module names are editable.
28. Theory and examples are editable.
29. Practice tests are editable.
30. Personal notes and bookmarks work.
31. Personal learning planner works.
32. Analytics work correctly.
33. Admin management works.
34. Mobile responsiveness works.
35. All existing application features pass regression testing.

------------------------------------------------------------------------

## MOST IMPORTANT DEVELOPMENT INSTRUCTIONS

Do not create a static demo or a frontend-only implementation.

Build a genuine SQL Learning Management System connected to the existing
backend, database and SQL execution infrastructure.

Before coding:

1.  Inspect the existing repository.
2.  Understand the current SQL Lab implementation.
3.  Understand the current database architecture.
4.  Understand authentication and user-specific data storage.
5.  Understand the existing UI design.
6.  Prepare an implementation plan.
7.  Identify reusable components and APIs.
8.  Implement in phases.

Do not remove existing functionality or reset user progress.

Do not hardcode user-specific learning progress.

All learning progress, revision counts, completion states, notes,
bookmarks, attempts and custom curriculum changes must persist in the
database.

All user-specific information must be isolated by user_id.

Do not claim that a topic, test or example is implemented until it has
actually been created and validated.

## FINAL IMPLEMENTATION REPORT

At the end of development, provide a detailed report showing:

-   Modules implemented / 24.
-   Topics implemented / total.
-   Topics with complete theory.
-   Topics with 5 examples.
-   Topics with 5 tests.
-   Total valid practice questions.
-   Number of validated SQL queries.
-   SQL Lab integration status.
-   Learning checklist status.
-   Revision management status.
-   Revision history status.
-   Custom curriculum editor status.
-   Analytics status.
-   Admin management status.
-   Tests passed.
-   Existing functionality regression-tested.
-   Remaining incomplete features.

The ultimate goal is to create a complete SQL mastery platform that
takes a learner from basic SQL knowledge to advanced SQL problem-solving
and real-world Data Engineering / ETL Developer interview readiness.

The system must also act as a personal learning record: it should
remember what I have studied, what I have practised, what I have
mastered and what I need to revise, without forcing me to repeat
already-completed learning unnecessarily.