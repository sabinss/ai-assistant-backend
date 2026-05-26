const DEFAULT_ORG_CUSTOMER_INSIGHTS_PROMPTS = {
  schema_prompt: `
companies: [company_id, name, domain, csm_name, csm_email, hubspot_company_id, zendesk_org_id, source, start_date, csm_agent, renewal_date, renewal_duration, stage, arr, internal_company_id, app_company_id, company_email, phone_number, industry, website, employees, plan_tier, value_realisation_score, churn_risk_score, expansion_opp_score, prev_month_value_realisation_score, prev_month_churn_risk_score, prev_month_expansion_opp_score]
Active_companies: [company_id, name, domain, csm_name, csm_email, hubspot_company_id, zendesk_org_id, source, start_date, csm_agent, renewal_date, renewal_duration, stage, arr, internal_company_id, app_company_id, company_email, phone_number, industry, website, employees, plan_tier, value_realisation_score, churn_risk_score, expansion_opp_score, prev_month_value_realisation_score, prev_month_churn_risk_score, prev_month_expansion_opp_score]
contacts table: [contact_id, firstname, lastname, email, company_id, created_date, last_modified_date, title, phone, role_type, is_active, last_engagement, company_name]
deals table: [deal_id,  dealname,  amount,  dealstage,  company_name,  created_at,  closedate, last_modified_date]
notes table: [note_id,  created_date,  company_name,  note_body, last_modified_date]
calls table: [call_id, created_at, hs_call_title, hs_call_body, updated_at, hs_lastmodifieddate, company_name, company_id, contact_id, contact_name]
tasks table: [task_id,  hs_task_subject, hs_task_body, hs_task_status, hs_task_priority, hs_task_type, created_at,  updated_at,  company_name]
tickets table: [ticket_id, subject, priority, status, assignee_id, requester_id, submitter_id, organization_id, created_at, updated_at, description, type, tags, satisfaction_rating, group_id, custom_fields, due_at, problem_id, raw_subject, resolved_date, contact_id, contact_name, company_name]
tickets_comments table: [comment_id, ticket_id, company_name, comment, status, comment_date]
customer_features table: [feature_id, created_at, updated_at, feature_description,  email, company_name, version, product]
customer_logins table: [login_id, created_at, updated_at, email, company_name, company_id, version, product]
feedback table: [feedback_id, created_at, updated_at, user_email, feedback_description, reported_query, rating, company_name]  
Engagement_Summary table: [customer_id, customer_name, week_date, sentiment, risk, opportunity, followup]
customer_score_view: [tenant_id, customer_id, summary_date, health_score, churn_risk_score, expansion_opp_score, recommendation, updated_ts, created_ts, year, month, health_score_analysis, churn_score_analysis, expansion_score_analysis]
score_details_view: [tenant_id, customer_id, year, month, score_type, score_driver_id, score, score_analysis]
messages:[conversation_id, type, thread_id, id, contact_id, subject, from, to, body, created_at, updated_at, direction, status, company_id, company_name]
companies_change_log: [change_date, company_id, company_name, summarization_needed, summarized, alert_sent]
open_tickets_view: [ticket_id, description, created_at, open_days, company_id,  company_name, support_user_name, support_user_email]
feature_usage_summary_view: [ app_company_id, company_name, "24_hours_bids", "30_days_bids", "7_days_bids"]
Alert_log_view:[ alert_id, tenant_id, owner_id, alert, alert_type, sent_date, url, "read", addressed, recipients, created_date, updated_date, company_id, week_date, company_name]
customer_activities_summary: [tenant_id, summary_date, company_id, ext_int, source, source_id, url, category, sentiment, sentiment_strength, reason, business_signal, summary, item_id, contact_id, channel, direction, content_summary, sentiment_reason, signal_strength, topic, domain, event_type, entity_name, entity_role, engagement_level, engagement_reason, company_name]
company_engagement_stats: [company_id, contact_id, month, email_inbound_count, email_outbound_count, ticket_total_count, ticket_severe_count, avg_resolution_time_days, open_tickets_and_duration, longest_open_ticket_duration_days, company_name, contact_name]
external_signals: [signal_id, company_id, date_detected, signal_title, signal_type, description, company_name]
actions: [id, source, crm_task_id, company_id, contact_id, assigned_to, created_by, action_type, tier, due_date, description, context, status, outcome, override_reason, notes, follow_up, follow_up_date, follow_up_notes, created_at, updated_at, completed_at, snoozed_until, action_detail, company_name, contact_name]
action_assigned_counts: [assigned_to, today, this_week, this_month, watch]
usage_funnel_view: [company_id, company_name, month_week, login, task_created, task_completed, task_automated, stage, license_purchased_count, active_users_count, avg_logins_per_user_per_week]
company_score: [tenant_id, company_id, scoring_date, company_name, year, month, account_stage, scoring_window_days, sentiment_score, sentiment_score_drivers, communication_engagement_score, communication_engagement_drivers, support_experience_score, support_experience_drivers, value_realisation_score, value_realisation_drivers, risk_score, risk_score_drivers, risk_override_applied, risk_override_reason, opportunity_score, opportunity_score_drivers, opportunity_gate_failed, opportunity_gate_reason, sentiment_trajectory, engagement_trend, single_contact_dependency, features_never_used, usage_declining, inbound_outbound_ratio, days_since_contract_start, override_triggers_detected, health_score, health_score_analysis]
`,
  abstract_refinement_prompt: `
Please check if the query is abstract meaning it does not define what field and condition to look for. And if it’s abstract form the natural language like query, if not just show the same as it’s coming from the user. Do not worry about exact field but should actually quantify the rule. Do not explain the reason etc. Just write updated query and the final query and not even user query. I just need to know the result. 
Never use Organization id as company id. Cause Company is customer. 

Here are some examples of User query and updated query. 

User Query: Show me summary of current state of Customer Hyatt 
Updated Query: Fetch all the information that you know about Hyatt
Final Query: Show me the summary of current state of customer in following format
Customer information
Summary of highlights from CRM notes, calls, meetings 
List of the deals with final total amount of open deals
List of open tickets with priority
Login and feature usage details

User Query: Show me customer sentiments for Hyatt
Updated Query:Get all the information related to Hyatt that has sentiments data, like customer conversation, support feedback, support ticket and ticket comments, calls, meeting, notes.
Final Query: Show me customer sentiments for Hyatt
Summary of Positive sentiments
Summary of Negative sentiments
Assessment of Sentiments from 1 to 10 , 10 being the most positive

User Query: Show me top 5 risky customers
Updated Query: Get list of customers that has highest total amount of deals not closed , crm notes, support tickets, ticket comments, low login counts, highest number of open tickets, low feature usage, low average customer survey score
Final Query: Review the available customer data and score the potential churn score from 1 to 10, 10 being highest potential of the churn. Provide data in table format with top 5 risky customers. 


User Query: Write status report for Hyatt that I need to send it my boss
Updated Query:Get all the information that you know about Hyatt, even including activities of Support Tickets
Final Query: Write status report for Hyatt that is appropriate to send it to my boss 

User Query: I need to meet with Jim from Hyatt , please let me know if I should be caution about anything
Updated Query:Get all the information that has customer sentiments data, like customer conversation, support feedback, support ticket and ticket comments, calls, meeting, notes. 
Final Query: Check if there is any information that raise a flag about Jim and summarize it as things that needs to be cautious about. 

User Query: Which customer should I prioritize
Updated Query:Get list of top 5 customers that has highest total amount of deals pending , has low health score, highest number of open tickets, low average customer survey score and that are close to renewal date
Final Query: Which customer should I prioritize

User Query: Which of our top revenue-generating customers are at high or medium risk?
Updated Query:Get list of top 5 customers that has highest ARR , has low health score, highest number of open tickets, low average customer survey score and that are close to renewal date
Final Query: Which of our top revenue-generating customers are at high or medium risk?

User Query: Show me all customer information for Hyatt
Updated Query: Show me all customer information for Hyatt
Final Query: Show me all customer information for Hyatt

User Query: Show me all the contacts and support ticket for Hyatt
Updated query: Show me all the contacts and support ticket for Hyatt
Final Query: Show me all the contacts and support ticket for Hyatt

User Query: Show to top 5 customers with highest amount of deals and highest open tickets
Updated  Query: Show to top 5 customers with highest amount of deals and highest open tickets
Final Query: Show to top 5 customers with highest amount of deals and highest open tickets 

User Query: Fetch customer name for domain hyatt.com
Updated Query: Fetch customer name where domain is hyatt.com
Final Query: Fetch customer name for domain hyatt.com

User Query: I am meeting with Support Manager today. Analyze the the support tickets and comments and see user of company has negative sentiments, so that I can talk to him. Show me top 3 companies with negative sentiments.
Updated Query: Fetch all support tickets and ticket comments related to all the customers. 
Final Query: I am meeting with Support Manager today. Analyze the the support tickets and comments and see user of company has negative sentiments, so that I can talk to him. Show me top 3 companies with negative sentiments.


User Query: Show me CRM data for Hilton.
Updated Query: Show me contacts, deals, calls, meetings, notes for Hilton.
Final Query: Show me all CRM data for Hilton.

User Query: Show me support information for Hyatt.
Updated Query: Show me tickets, tickets comments, customer conversations, feedbacks for Hyatt.
Final Query: Show me support information for Hyatt.

User Query: Show me CSM information for Hyatt.
Updated Query: Show me customer health, login details, features for Hyatt.
Final Query: Show me CSM information for Hyatt.

User Query: Is there follow up needed with any customers?
Updated Query: Fetch crm notes for all customers.
Final Query: Is there follow up needed with any customers?

User Query: Show me top 5 important or urgent follow up that I need to do.
Updated Query: Fetch crm notes , support ticket , ticket comments for all customers. 
Final Query: Show me top 5 important or urgent follow up that I need to do.

User Query: I am meeting with support manager, give me top 3 hot issues that I need to talk to him?
Updated Query: Fetch support tickets of high priority with their ticket comments for all customers.
Final Query: I am meeting with support manager, give me top 3 hot issues that I need to talk to him?

User Query: Show me top 3 customers that has potential for upsell.
Updated Query: Fetch CRM notes, deals, support ticket, customer health record, feedback for all customers
Final Query: Analyze all the hard data and sentiments and predict top 3 customers that has high potential for upsell. Do not forget to look at the CRM Notes and Support ticket comments for user sentiments. Do not focus mostly on open deals, but think about the stage of the open deals if they are close to being closed. Plus look at the support satisfaction, any champion we have at customer site etc. 


User Query: Show me the renewal likelihood from 1 to 5 , 5 being highest and provide your recommendations
Updated Query: Fetch  HIlton's CRM notes, CSM login, feature usage, support tickets, ticket comments, Feedback
Final Query: Review above information and assess  renewal likelihood from 1 to 5 , 5 being highest and provide your recommendations 

User Query: Get scope meeting transcript in CRM Notes for Hilton
Updated Query: Fetch Hilton's all CRM notes
Final Query: Get details of Scope meeting transcript from CRM Notes for Hilton

User Query: Show me customer list
Updated Query: Fetch all customer name 
Final Query: Show me customer list

User Query: Show me the list of customers that has high potential of churn.
Updated Query: Fetch CRM deals, CRM Notes, Support tickets, support ticket comments, survey feedback data 
Final Query:  Review the available customer data and score the potential churn score from 1 to 10, 10 being highest potential of the churn. Provide data in table format.

User Query: Show me customer list for Organization_id "kashfuewrwqkfka2343:"
Updated Query: Fetch all customer name 
Final Query: Show me customer list

User Query: Get the customer list with customer_id and name, CRM notes, ticket descriptions, ticket comments, Customer Conversation, Messages, Feedback descriptions for the week starting May 26th, 2025.
Updated Query: Get the customer list with customer_id and name, CRM notes, ticket descriptions, ticket comments, Customer Conversation,  Messages,Feedback descriptions for the week starting May 26th, 2025.
Final Query: Get the customer list with customer_id and name, CRM notes, ticket descriptions, ticket comments, Customer Conversation,  Messages, Feedback descriptions for the week starting May 26th, 2025.
`,
  nltosql_prompt: `
Guidelines:
1.⁠ ⁠Perform table join carefully and use the appropriate column names and appropriate conditions.
2.⁠ ⁠Dates and time are in ISO format.
3.⁠ ⁠Do not add new lines inside the queries.
4.⁠ ⁠Make sure you use correct column and table names as given in the schema.
5.⁠ ⁠Do not perform data type casting on columns.
6.⁠ ⁠The words "Company", "Organization", "customer", and "companies" are used interchangeably.
7.⁠ ⁠If a query requires specific columns, make sure to include only these columns in the SELECT clause.
8.⁠ ⁠If a query requires directly retrieving data from multiple tables, return separate queries, one for each table. Separate the queries with a semicolon. 
    precede each query with a comment that describes which table it is pulling FROM  If it was pulling from multiple tables precede the single query with "Multiple tables::".       
9. Do not include any metadata labels. Do not add "::" or any non-SQL prefixes when generating SQL. Only generate clean, executable SQL starting directly with SELECT.

        
Natural Language Query: Show me the first 2 companies separately
SQL Query: companies:: SELECT * FROM companies LIMIT 2;     

Natural Language Query: Show me the top companies that have highest number of deals separately
SQL Query: Multiple tables:: SELECT c.company_id, c.name, c.domain, COUNT(d.deal_id) AS num_deals FROM companies AS c
JOIN deals AS d
ON c.name = d.company_name
GROUP BY c.company_id, c.name, c.domain
ORDER BY num_deals DESC
LIMIT 10;

Natural Language Query: Show me list of contacts, deals and open support tickets for Hyatt separately 
SQL Query: contacts:: SELECT * FROM contacts WHERE company_name = 'Hyatt'; deals:: SELECT * FROM deals WHERE company_name = 'Hyatt'; tickets:: SELECT * FROM tickets WHERE company_name = 'Hyatt' AND status = 'open';

Natural Language Query: Show me the health of the Hyatt
SQL Query: customer_health:: SELECT * FROM customer_health WHERE customer_name = 'Hyatt'

Natural Language Query: Show me the list of contacts for Hyatt
SQL Query: contacts:: SELECT contacts.first_name, contacts.last_name, contacts.email FROM contacts WHERE company_name = 'Hyatt';

Natural Language Query: Fetch customer name where domain is hyatt.com
SQL Query: companies:: SELECT * FROM companies WHERE domain = 'hyatt.com';

Natural Language Query: Show login trend for Hilton by month.
SQL Query: "customer_logins:: SELECT DATE_TRUNC('month', login_date) AS month, COUNT(login_id) AS login_count FROM customer_logins WHERE company_name = 'Hilton' GROUP BY month ORDER BY month

Natural Language Query: Show me the top 5 companies that has highest amount of pending deals
SQL Query: Multiple tables:: SELECT c.company_id, c.name, c.domain, SUM(d.amount) AS total_pending_amount FROM companies AS c JOIN deals AS d ON c.name = d.company_name WHERE d.dealstage <> 'closedwon' or d.dealstage <> 'closedlost' GROUP BY c.company_id, c.name, c.domain ORDER BY total_pending_amount DESC LIMIT 5;

Natural Language Query: Fetch customers that are added last week
SQL Query: companies:: SELECT * FROM companies WHERE Start_date >= CURRENT_DATE - 7;

Natural Language Query: Fetch customer list 
SQL Query: companies:: SELECT * FROM companies;

Natural Laguage Query: Get CRM notes, ticket descriptions, ticket comments, customer conversations, and feedback descriptions for the week starting September 9th, 2024.
SQL Query: 
SELECT "CRM_Notes" AS source, note_body AS content, created_date, company_name
FROM notes
WHERE created_date >= DATE '2024-09-09'
  AND created_date < DATE '2024-09-09' + 7

UNION ALL

SELECT 'Ticket Description' AS source, description AS content, created_at, company_name
FROM tickets
WHERE created_at >= DATE '2024-09-09'
  AND created_at < DATE '2024-09-09' + 7

UNION ALL

SELECT 'Ticket Comment' AS source, comment AS content, comment_date, company_name
FROM ticket_comments
WHERE comment_date >= DATE '2024-09-09'
  AND comment_date < DATE '2024-09-09' + 7


UNION ALL

SELECT 'Feedback' AS source, feedback_description AS content, updated_at, company_name
FROM feedback
WHERE updated_at >= DATE '2024-09-09'
  AND updated_at < DATE '2024-09-09' + 7


Natural Language Query: Get login count for the quarter starting April 2025 for each customer, filtered by updated_at date.
SQL Query: SELECT COUNT(updated_at), company_name FROM customer_logins WHERE updated_at >= DATE '2025-04-01' AND updated_at < DATE '2025-04-01' + INTERVAL '3 months' GROUP BY company_name 

Natural Language Query: Get feature usage count for the quarter starting April 2025 for each feature by customer
SQL Query: SELECT feature_description, company_name, COUNT(feature_id) AS feature_usage_count FROM customer_features WHERE updated_at >= DATE '2025-04-01' AND updated_at < DATE '2025-04-01' + INTERVAL '3 months' GROUP BY feature_description, company_name

Natural Language Query: Get count of feedback from feedback for the quarter starting April 2025 filter by updated_at date by customer, rating
SQL Query: SELECT company_name, rating, COUNT(feedback_id) AS feedback_count FROM feedback WHERE updated_at >= DATE '2025-04-01' AND updated_at < DATE '2025-04-01' + INTERVAL '3 months' GROUP BY company_name, rating


Natural Language Query: Show me score details
SQL Query: SELECT * FROM score_details_view

Natural Language Query: Show me engagement summary for customer ids '1231231','22222','33333'.
SQL Query: SELECT * FROM engagement_summary WHERE week_date >= '2025-05-14' AND week_date <= '2025-08-14' AND company_Id in ['1231231','22222','33333']

Natural Language Query: Fetch customer id , customer name where summary needed is true and summarized is false for sept 11, 2025
SQL Query: SELECT * FROM companies_change_log WHERE summarization_needed = True and summarized = False and change_date='2025-09-11'

Natural Language Query: Fetch customer id , customer name where summary needed is true and summarized is false and change date is for yesterday
SQL Query: SELECT company_id, company_name FROM DB689e567cb613070f268f5b5c. companies_change_log WHERE summarization_needed = True AND summarized = False AND change_date = CURRENT_DATE - INTERVAL '1 day'

Natural Language Query: Fetch customer id , customer name where summarized is true and alert sent is false and  where change date for yesterday
SQL Query: SELECT company_id, company_name FROM DB689e567cb613070f268f5b5c. companies_change_log WHERE summarized = True AND alert_sent = False AND change_date = CURRENT_DATE - INTERVAL '1 day'

Natural Language Query: Fetch crm customer notes along with note id for company ids '1231231','22222','33333' for september 10, 2025
SQL Query: SELECT 'CRM Notes' AS source, note_id, note_body AS content, created_date, company_name 
FROM notes 
WHERE 
company_id in ('1231231','22222','33333')
AND date(last_modified_date) = '2025-09-10';


Natural Language Query: Fetch tickets that are open for more than 5 days
SQL Query:  SELECT * FROM open_tickets_view" where open_days>5

Natural Language Query: Fetch customers that have 7_day_bids sent  zero or 30_day_bids sent less than 15
SQL Query:  SELECT * FROM feature_usage_summary_view WHERE  CAST("30_days_bids" as integer) <15 or CAST("7_days_bids" as integer) = 0


Natural Language Query: Fetch only inbound messages with id for Famously Clean company for date from '2025-09-14' to '2025-09-17'
SQL Query: SELECT 'Messages' AS source, id AS record_id, body AS content, updated_at, company_name 
FROM  messages 
WHERE company_name = 'Famously Clean' 
AND direction = 'inbound'
AND DATE(updated_at) >='2025-09-14' 
AND DATE(updated_at) <='2025-09-17'

Natural Language Query: Fetch distinct company name and company id from engagement summary records for this month
SQL Query:  select DISTINCT customer_id, customer_name from  engagement_summary WHERE week_date >= date_trunc('month', CURRENT_DATE) order by customer_name ASC

Natural Language Query: Fetch only summary_info column from engagement summary for September.
SQL Query: 
SELECT customer_id, customer_name, week_date,  summary_info
FROM  engagement_summary
WHERE week_date >= '2025-09-01' AND week_date <= '2025-09-30'

Natural Language Query: Fetch list of details from feature usage summary that has bids 30 days bids less than half of Average last 6 months bids and last 6 months bids is greater than 30 and stage is not null 
SQL Query: Select * from feature_usage_summary_view where CAST("30_days_bids" AS integer) < (CAST("average_last_6months_bids" AS integer) / 2) and CAST("average_last_6months_bids" AS integer)> 30 and stage is NOT NULL

Natural Language Query: Fetch top 10 list of details from feature usage summary that has 30 days bids greater lesser than 7 days bids and 7 days bids greater than 0
SQL Query: SELECT app_company_id, company_name, "24_hours_bids", "30_days_bids", "7_days_bids" FROM DB689e567cb613070f268f5b5c.feature_usage_summary_view WHERE "30_days_bids"::int < "7_days_bids"::int AND "7_days_bids"::int > 0 ORDER BY "30_days_bids"::int DESC LIMIT 10;

Natural Language Query:  Fetch tickets information for company_ids ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') for '2025-10-28'
SQL Query: SELECT * FROM tickets WHERE company_id IN ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') AND DATE(created_at) = '2025-10-28'

Natural Language Query:  Fetch tickets_comments information for company_ids ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') for '2025-10-28'
SQL Query: SELECT * FROM tickets_comments WHERE company_id IN ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') AND DATE(comment_date) = '2025-10-28'

Natural Language Query:  Fetch Notes information for company_ids ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') for '2025-10-28'
SQL Query: SELECT * FROM Notes WHERE company_id IN ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') AND DATE(last_modified_date) = '2025-10-28'

Natural Language Query:  Fetch sentiment, direct churn signals, follow up items from engagement summary  for company_ids ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a') for '2025-10-28'
SQL Query: SELECT sentiment, risk AS direct_churn_signals, followup AS follow_up_items FROM engagement_summary WHERE customer_id IN ('68cb04818ddca15cc25d6a5a', '68cb047c8ddca15cc25d670a')  AND week_date = '2025-10-28'


Natural Language Query:  Fetch customer_score_view details  for company_name ('A Step Up Window Cleaning LLC') 
SQL Query: 
SELECT * FROM customer_score_view WHERE customer_id in  (SELECT company_id FROM companies WHERE name = 'A Step Up Window Cleaning LLC')

Natural Language Query:  Show me details from Customer activities Summary
SQL Query:  SELECT * FROM  Customer_activities_Summary



Natural Language Query:  Fetch deals where ((dealstage='Open' and (Today - date(Created_date)) between 2 and 5 ) or (dealstage ='Seq_1_Sent' and (Today - date(Created_date)) between 7 and 9 ) or (dealstage ='Seq_2_Sent' and (Today - date(Created_date)) between 14 and 17 ) or (dealstage ='Seq_3_Sent' and (Today - date(Created_date)) between 25 and 28 ). or (dealstage ='Seq_4_Sent' and (Today - date(Created_date)) between 38 and 42 ). or (dealstage ='Seq_5_Sent' and (Today - date(Created_date)) between 55 and 60 ))
SQL Query:  SELECT * FROM deals WHERE (dealstage = 'Open' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 2 AND 5) 
OR 
(dealstage = 'Seq_1_Sent' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 7 AND 9) 
OR 
(dealstage = 'Seq_2_Sent' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 14 AND 17) 
OR 
(dealstage = 'Seq_3_Sent' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 25 AND 28) 
OR (dealstage = 'Seq_4_Sent' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 38 AND 42) 
OR (dealstage = 'Seq_5_Sent' AND (CURRENT_DATE - DATE(created_at)) BETWEEN 55 AND 60)
`,
};
module.exports = DEFAULT_ORG_CUSTOMER_INSIGHTS_PROMPTS;
