import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { queryAll, queryOne, execute, newId } from "../db/database";
import { camelAll, camel } from "../db/map";
import { Public, Roles } from "../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../common/guards";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  @Public()
  @Get()
  async list() {
    return camelAll(await queryAll(`SELECT * FROM categories ORDER BY name ASC`));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  async create(@Body() body: { name: string; slug: string; imageUrl?: string; parentId?: string }) {
    const id = newId();
    await execute(
      `INSERT INTO categories (id, name, slug, image_url, parent_id) VALUES (?, ?, ?, ?, ?)`,
      [id, body.name, body.slug, body.imageUrl ?? null, body.parentId ?? null]
    );
    return camel(await queryOne(`SELECT * FROM categories WHERE id = ?`, [id]));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Put(":id")
  async update(@Param("id") id: string, @Body() body: any) {
    const fields: string[] = [];
    const params: any[] = [];
    const map: Record<string, string> = {
      name: "name", slug: "slug", imageUrl: "image_url", parentId: "parent_id",
    };
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) { fields.push(`${col} = ?`); params.push(body[key]); }
    }
    if (fields.length) await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, [...params, id]);
    return camel(await queryOne(`SELECT * FROM categories WHERE id = ?`, [id]));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await execute(`DELETE FROM categories WHERE id = ?`, [id]);
    return { ok: true };
  }
}

@Module({
  controllers: [CategoriesController],
})
export class CategoriesModule {}
