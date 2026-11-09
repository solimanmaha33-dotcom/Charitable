begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select has_column('public','case_branches','is_active','branches have an active flag for soft deactivation');

select * from finish();
rollback;
