'use server';

import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from 'next/cache'
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export type State = {
    errors?: {
        customerId?: string[],
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
}

const InvoiceSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: '请选择一个用户',
    }),
    amount: z.coerce.number().gt(
        0, { message: '请输入大于0美元的金额' }
    ),  // amount 会被强制转换为 number 类型
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: '请选择一个发票状态',
    }),
    date: z.string(),
})

const CreateInvoice = InvoiceSchema.omit({ id: true, date: true })

export async function createInvoice(prevState: State, formData: FormData) {

    // 输入验证
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: '有选项尚未填写，创建发票失败',
        };
    }

    const { customerId, amount, status } = validatedFields.data

    const amountInCents = amount * 100
    // 生成年月日
    // new Date().toISOString() == yyyy-MM-ddTHH:mm:ss.sssZ
    const date = new Date().toISOString().split('T')[0]

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${ customerId }, ${ amountInCents }, ${ status }, ${ date })
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.'
        };
    }

    revalidatePath('/dashboard/invoices')
    redirect('/dashboard/invoices')
}

const UpdateInvoice = InvoiceSchema.omit({ date: true })
export async function updateInvoice(prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        id: formData.get('id'),
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: '有选项尚未填写，更新发票失败',
        };
    }

    const { id, customerId, amount, status } = validatedFields.data
     
    const amountInCents = amount * 100;
    
    try {
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Update Invoice.'
        }
    }
     
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(formData: FormData) {
    const id = formData.get('id')?.toString();
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { 
            message: 'Database Error: Failed to Delete Invoice.'
         }
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes('CredentialsSignin')) {
            return 'CredentialSignin';
        }
        throw error;
    }
}