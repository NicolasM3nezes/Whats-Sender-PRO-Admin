update public.app_release_files
set target_path = case
  when relative_path = '_internal.zip' then '_internal'
  else coalesce(nullif(target_path,''), relative_path)
end,
install_mode = case
  when relative_path = '_internal.zip' then 'extract_zip'
  else coalesce(nullif(install_mode,''), 'file')
end
where target_path is null or target_path = '' or install_mode is null or install_mode = '' or relative_path = '_internal.zip';
