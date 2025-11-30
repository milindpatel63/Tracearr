CREATE INDEX "sessions_geo_idx" ON "sessions" USING btree ("geo_lat","geo_lon");--> statement-breakpoint
CREATE INDEX "sessions_geo_time_idx" ON "sessions" USING btree ("started_at","geo_lat","geo_lon");--> statement-breakpoint
CREATE INDEX "sessions_media_type_idx" ON "sessions" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "sessions_transcode_idx" ON "sessions" USING btree ("is_transcode");--> statement-breakpoint
CREATE INDEX "sessions_platform_idx" ON "sessions" USING btree ("platform");