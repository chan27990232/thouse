-- Re-send listing for platform review when cover image or listing media changes.
create or replace function public.trg_property_listing_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_app_admin() then
    if TG_OP = 'UPDATE' and new.verification_status = 'approved' and (old.verification_status is distinct from 'approved') then
      new.verified_at := coalesce(new.verified_at, now());
      new.verified_by := coalesce(new.verified_by, auth.uid());
    elsif TG_OP = 'UPDATE' and new.verification_status = 'rejected' and (old.verification_status is distinct from 'rejected') then
      new.verified_at := coalesce(new.verified_at, now());
      new.verified_by := coalesce(new.verified_by, auth.uid());
    end if;
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.verification_status := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_rejected_reason := '';
    if coalesce(jsonb_array_length(new.proof_photo_urls), 0) < 1
       or (
         coalesce(jsonb_array_length(new.property_deed_urls), 0) < 1
         and btrim(coalesce(new.property_deed_url, '')) = ''
       ) then
      raise exception '須上傳至少一張實景佐證照片及一個房產證明檔案';
    end if;
    if coalesce(jsonb_array_length(new.property_deed_urls), 0) >= 1
       and btrim(coalesce(new.property_deed_url, '')) = '' then
      new.property_deed_url := new.property_deed_urls->>0;
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if (new.proof_photo_urls is distinct from old.proof_photo_urls
        or new.property_deed_urls is distinct from old.property_deed_urls
        or btrim(coalesce(new.property_deed_url, '')) is distinct from btrim(coalesce(old.property_deed_url, ''))
        or btrim(coalesce(new.image, '')) is distinct from btrim(coalesce(old.image, ''))
        or btrim(coalesce(new.title, '')) is distinct from btrim(coalesce(old.title, ''))
        or new.price is distinct from old.price
        or new.area is distinct from old.area
        or new.floor is distinct from old.floor
        or btrim(coalesce(new.district, '')) is distinct from btrim(coalesce(old.district, ''))
        or btrim(coalesce(new.description, '')) is distinct from btrim(coalesce(old.description, ''))
        or new.bedrooms is distinct from old.bedrooms
        or new.bathrooms is distinct from old.bathrooms
        or new.room_features is distinct from old.room_features
        or new.amenities is distinct from old.amenities
        or new.built_year is distinct from old.built_year
        or new.renovation_year is distinct from old.renovation_year) then
      new.verification_status := 'pending';
      new.verification_rejected_reason := '';
      new.verified_at := null;
      new.verified_by := null;
    else
      new.verification_status := old.verification_status;
      new.verification_rejected_reason := old.verification_rejected_reason;
      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
    end if;
    return new;
  end if;

  return new;
end;
$$;
